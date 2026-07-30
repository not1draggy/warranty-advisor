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
  JOB_TIMEOUT_MS,
  allowRequest,
  clientIp,
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
