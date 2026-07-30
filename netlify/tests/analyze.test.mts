/**
 * Tests for the analysis endpoint.
 *
 * These live outside `netlify/functions/` on purpose: Netlify deploys every
 * file in that directory as a serverless function, so a test file there is
 * bundled and shipped, and the deploy fails on its dev-only imports.
 *
 * The `../lib/store` mock path resolves to the same module the handler
 * imports, because both files sit one level under `netlify/`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@netlify/functions";
import type { Job } from "../lib/store";

const store = vi.hoisted(() => ({
  readJob: vi.fn(),
  writeJob: vi.fn(),
  allowRequest: vi.fn(),
  claimJob: vi.fn(),
  jobId: vi.fn(() => "job-1"),
  clientIp: vi.fn(() => "1.2.3.4"),
  log: vi.fn(),
}));

vi.mock("../lib/store", () => store);

const { default: handler } = await import("../functions/analyze.mjs");

const ENDPOINT = "https://example.com/api/v1/analyses";

const post = (body: unknown) =>
  new Request(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/** Netlify supplies route params; only `params` matters to this handler. */
const context = (params: Record<string, string> = {}) => ({ params }) as unknown as Context;

const readyJob: Job = {
  id: "job-1",
  query: "Bosch WAN28160BY",
  status: "ready",
  createdAt: Date.now(),
  evidence: { product: { model: "WAN28160BY" } } as unknown as Job["evidence"],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
  store.readJob.mockResolvedValue(null);
  store.writeJob.mockResolvedValue(undefined);
  store.allowRequest.mockResolvedValue(true);
  store.claimJob.mockResolvedValue(true);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 202 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
});

describe("POST /api/v1/analyses", () => {
  it("reports itself unavailable when no key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const response = await handler(post({ query: "Bosch" }), context());

    expect(response.status).toBe(503);
    // The client falls back to the demo catalogue on this, so no job is made.
    expect(store.writeJob).not.toHaveBeenCalled();
  });

  it("rejects a query too short to identify a product", async () => {
    expect((await handler(post({ query: "x" }), context())).status).toBe(400);
  });

  it("rejects a query long enough to be an injection attempt", async () => {
    const response = await handler(post({ query: "a".repeat(200) }), context());
    expect(response.status).toBe(400);
  });

  it("rejects a body that is not an object", async () => {
    expect((await handler(post("not json"), context())).status).toBe(400);
  });

  it("rejects a missing query", async () => {
    expect((await handler(post({}), context())).status).toBe(400);
  });

  it("serves a cached analysis without paying for research again", async () => {
    store.readJob.mockResolvedValue(readyJob);

    const response = await handler(post({ query: "Bosch WAN28160BY" }), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ready", live: true });
    expect(fetch).not.toHaveBeenCalled();
    expect(store.allowRequest).not.toHaveBeenCalled();
  });

  it("resumes a run in progress rather than paying for it twice", async () => {
    // The client gives up before the job does, so a retry must find the same
    // job still pending and go back to polling it.
    store.readJob.mockResolvedValue({ ...readyJob, status: "pending", evidence: undefined });

    const response = await handler(post({ query: "Bosch WAN28160BY" }), context());

    await expect(response.json()).resolves.toMatchObject({ status: "pending" });
    expect(fetch).not.toHaveBeenCalled();
    expect(store.writeJob).not.toHaveBeenCalled();
  });

  it("re-researches instead of replaying a cached failure", async () => {
    // Otherwise one transient upstream error would block the product forever.
    store.readJob.mockResolvedValue({
      ...readyJob,
      status: "failed",
      reason: "upstream_error",
      evidence: undefined,
    });

    const response = await handler(post({ query: "Bosch WAN28160BY" }), context());

    expect(response.status).toBe(202);
    expect(fetch).toHaveBeenCalled();
  });

  it("starts research and hands it to the worker", async () => {
    const response = await handler(post({ query: "Bosch WAN28160BY" }), context());

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ id: "job-1", status: "pending" });
    expect(store.claimJob).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));

    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/.netlify/functions/analyze-background");
    expect(init).toMatchObject({ method: "POST" });
  });

  it("does not dispatch a second worker when another request got there first", async () => {
    // A shared link can put several people on the same product at once.
    store.claimJob.mockResolvedValue(false);

    const response = await handler(post({ query: "Bosch WAN28160BY" }), context());

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ status: "pending" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a client that is asking too often", async () => {
    store.allowRequest.mockResolvedValue(false);

    const response = await handler(post({ query: "Bosch WAN28160BY" }), context());

    expect(response.status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("marks the job failed when the worker cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const response = await handler(post({ query: "Bosch WAN28160BY" }), context());

    expect(response.status).toBe(502);
    // Leaving it pending would make the client poll a job nobody is running.
    expect(store.writeJob).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "failed", reason: "worker_unavailable" }),
    );
  });

  it("marks the job failed when the worker rejects the handoff", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    expect((await handler(post({ query: "Bosch" }), context())).status).toBe(502);
  });
});

describe("GET /api/v1/analyses/:id", () => {
  const get = () => new Request(`${ENDPOINT}/job-1`);

  it("returns a finished analysis", async () => {
    store.readJob.mockResolvedValue(readyJob);

    const response = await handler(get(), context({ id: "job-1" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ready" });
  });

  it("reports a job still running without leaking internals", async () => {
    store.readJob.mockResolvedValue({ ...readyJob, status: "pending", evidence: undefined });

    const body = await (await handler(get(), context({ id: "job-1" }))).json();

    expect(body).toMatchObject({ status: "pending" });
    expect(body).not.toHaveProperty("query");
  });

  it("returns not found for a job that expired or never existed", async () => {
    expect((await handler(get(), context({ id: "job-1" }))).status).toBe(404);
  });
});

describe("deployable shape", () => {
  it("keeps the functions directory free of anything that is not a function", async () => {
    const { readdirSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const functionsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "functions");
    const entries = readdirSync(functionsDir);

    // Netlify deploys every file here. A test or helper file in this directory
    // is bundled as a function and fails the deploy on its dev-only imports.
    expect(entries.filter((name) => /\.(test|spec)\./.test(name))).toEqual([]);
    expect(entries.sort()).toEqual(["analyze-background.mts", "analyze.mts"]);
  });
});

describe("routing", () => {
  it("refuses a POST to a specific analysis", async () => {
    const response = await handler(post({ query: "Bosch" }), context({ id: "job-1" }));
    expect(response.status).toBe(405);
  });

  it("refuses a GET to the collection", async () => {
    expect((await handler(new Request(ENDPOINT), context())).status).toBe(405);
  });

  it("turns an unexpected fault into a clean error rather than a crash", async () => {
    store.readJob.mockRejectedValue(new Error("blobs unavailable"));

    const response = await handler(post({ query: "Bosch WAN28160BY" }), context());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "internal_error" });
  });
});
