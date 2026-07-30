import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** In-memory stand-in for Netlify Blobs, shared with the hoisted mock factory. */
const { blobs } = vi.hoisted(() => ({ blobs: new Map<string, Map<string, unknown>>() }));

vi.mock("@netlify/blobs", () => ({
  getStore: (name: string) => {
    if (!blobs.has(name)) blobs.set(name, new Map());
    const store = blobs.get(name)!;
    return {
      get: async (key: string) => (store.has(key) ? store.get(key) : null),
      setJSON: async (key: string, value: unknown) => void store.set(key, value),
    };
  },
}));

const {
  CACHE_TTL_MS,
  claimJob,
  FAILURE_TTL_MS,
  JOB_TIMEOUT_MS,
  allowRequest,
  allowResearch,
  clientIp,
  DEFAULT_DAILY_RESEARCH_LIMIT,
  jobId,
  readJob,
  writeJob,
} = await import("./store");

const LIMIT = { windowMs: 60_000, max: 3 };

beforeEach(() => {
  blobs.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-30T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("jobId", () => {
  it("gives cosmetically different spellings the same cache entry", () => {
    expect(jobId("Bosch WAN28160BY")).toBe(jobId("  bosch   wan28160by  "));
    expect(jobId("Bosch WAN-28160-BY")).toBe(jobId("bosch wan 28160 by"));
  });

  it("ignores Slovak diacritics", () => {
    expect(jobId("Práčka Bosch")).toBe(jobId("Pracka Bosch"));
  });

  it("keeps different products apart", () => {
    expect(jobId("Bosch WAN28160BY")).not.toBe(jobId("Bosch WAN28260BY"));
  });
});

describe("readJob", () => {
  it("returns nothing for an id that was never stored", async () => {
    expect(await readJob("missing")).toBeNull();
  });

  it("round-trips a finished analysis", async () => {
    await writeJob({ id: "a", query: "x", status: "ready", createdAt: Date.now() });
    expect(await readJob("a")).toMatchObject({ id: "a", status: "ready" });
  });

  it("serves a cached analysis until its time to live runs out", async () => {
    await writeJob({ id: "a", query: "x", status: "ready", createdAt: Date.now() });

    vi.advanceTimersByTime(CACHE_TTL_MS - 1_000);
    expect(await readJob("a")).not.toBeNull();

    vi.advanceTimersByTime(2_000);
    expect(await readJob("a")).toBeNull();
  });

  it("keeps a running job visible while it is still plausibly alive", async () => {
    await writeJob({ id: "b", query: "x", status: "pending", createdAt: Date.now() });

    vi.advanceTimersByTime(JOB_TIMEOUT_MS - 1_000);
    expect(await readJob("b")).toMatchObject({ status: "pending" });
  });

  it("lets a stalled job be retried rather than blocking the query forever", async () => {
    await writeJob({ id: "b", query: "x", status: "pending", createdAt: Date.now() });

    vi.advanceTimersByTime(JOB_TIMEOUT_MS + 1_000);
    expect(await readJob("b")).toBeNull();
  });

  it("stops serving a stale failure so the product can be examined again", async () => {
    await writeJob({
      id: "d",
      query: "x",
      status: "failed",
      reason: "upstream_error",
      createdAt: Date.now(),
    });

    vi.advanceTimersByTime(FAILURE_TTL_MS + 1_000);
    expect(await readJob("d")).toBeNull();
  });

  it("keeps a failure readable so the client can report it", async () => {
    await writeJob({
      id: "c",
      query: "x",
      status: "failed",
      reason: "upstream_error",
      createdAt: Date.now(),
    });
    expect(await readJob("c")).toMatchObject({ status: "failed", reason: "upstream_error" });
  });
});

describe("claimJob", () => {
  const pending = (claimedBy: string) => ({
    id: "job-1",
    query: "Bosch",
    status: "pending" as const,
    createdAt: Date.now(),
    claimedBy,
  });

  it("grants the claim when nobody else is asking", async () => {
    expect(await claimJob(pending("first"))).toBe(true);
  });

  it("refuses the claim to whoever was overwritten by a racing request", async () => {
    // "first" writes, then "second" writes; reading back, only "second" wins.
    await claimJob(pending("first"));
    expect(await claimJob(pending("second"))).toBe(true);
    expect((await readJob("job-1"))?.claimedBy).toBe("second");
  });

  it("stores the job whether or not the claim is won", async () => {
    await claimJob(pending("first"));
    expect(await readJob("job-1")).toMatchObject({ status: "pending" });
  });
});

describe("job lifetime against the client's patience", () => {
    it("outlives the interface, so a retry never duplicates a running job", async () => {
      // These two were once equal, so the moment the client gave up the job
      // was declared dead too — and retrying paid for the same research twice.
      const { POLL_TIMEOUT_MS } = await import("../../src/lib/api");
      expect(JOB_TIMEOUT_MS).toBeGreaterThan(POLL_TIMEOUT_MS);
    });

    it("expires a failure well before the job it belongs to", () => {
      expect(FAILURE_TTL_MS).toBeLessThan(JOB_TIMEOUT_MS);
    });
});

describe("allowRequest", () => {
  it("allows requests up to the limit and then refuses", async () => {
    for (let i = 0; i < LIMIT.max; i += 1) {
      expect(await allowRequest("1.2.3.4", LIMIT)).toBe(true);
    }
    expect(await allowRequest("1.2.3.4", LIMIT)).toBe(false);
  });

  it("counts each client separately", async () => {
    for (let i = 0; i < LIMIT.max; i += 1) await allowRequest("1.2.3.4", LIMIT);

    expect(await allowRequest("1.2.3.4", LIMIT)).toBe(false);
    expect(await allowRequest("5.6.7.8", LIMIT)).toBe(true);
  });

  it("lets a blocked client through again in the next window", async () => {
    for (let i = 0; i < LIMIT.max; i += 1) await allowRequest("1.2.3.4", LIMIT);
    expect(await allowRequest("1.2.3.4", LIMIT)).toBe(false);

    vi.advanceTimersByTime(LIMIT.windowMs);
    expect(await allowRequest("1.2.3.4", LIMIT)).toBe(true);
  });

  it("does not store the raw client address", async () => {
    await allowRequest("1.2.3.4", LIMIT);
    const keys = [...(blobs.get("rate-limits")?.keys() ?? [])];
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain("1.2.3.4");
  });
});

describe("clientIp", () => {
  const request = (headers: Record<string, string>) =>
    new Request("https://example.com", { headers });

  it("prefers the address Netlify resolved", () => {
    expect(
      clientIp(
        request({ "x-nf-client-connection-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2, 3.3.3.3" }),
      ),
    ).toBe("1.1.1.1");
  });

  it("falls back to the first forwarded address", () => {
    expect(clientIp(request({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
  });

  it("degrades to a shared bucket rather than throwing", () => {
    expect(clientIp(request({}))).toBe("unknown");
  });
});

describe("allowResearch", () => {
  afterEach(() => {
    delete process.env.DAILY_RESEARCH_LIMIT;
  });

  it("pays for runs up to the day's ceiling and then stops", async () => {
    process.env.DAILY_RESEARCH_LIMIT = "3";

    for (let i = 0; i < 3; i += 1) expect(await allowResearch()).toBe(true);
    expect(await allowResearch()).toBe(false);
  });

  it("starts a fresh budget the next day", async () => {
    process.env.DAILY_RESEARCH_LIMIT = "2";
    const today = new Date("2026-07-30T23:59:00Z");
    const tomorrow = new Date("2026-07-31T00:01:00Z");

    for (let i = 0; i < 2; i += 1) await allowResearch(today);
    expect(await allowResearch(today)).toBe(false);
    expect(await allowResearch(tomorrow)).toBe(true);
  });

  it("keeps working when the budget cannot be read", async () => {
    // Losing storage must not take the product down; a runaway bill is a
    // sustained failure, and the next request will still catch it.
    const failing = new Map<string, unknown>();
    // The stand-in consults `has` before `get`, so this is where a read breaks.
    Object.defineProperty(failing, "has", {
      value: () => {
        throw new Error("blobs unavailable");
      },
    });
    blobs.set("budget", failing as never);

    expect(await allowResearch()).toBe(true);
  });

  it("ships a ceiling even with nothing configured", async () => {
    expect(DEFAULT_DAILY_RESEARCH_LIMIT).toBeGreaterThan(0);
  });

  it("ignores a limit that is not a usable number", async () => {
    process.env.DAILY_RESEARCH_LIMIT = "nonsense";
    // Falling back to zero would take live analysis down site-wide.
    expect(await allowResearch(new Date("2026-01-01T00:00:00Z"))).toBe(true);
  });
});
