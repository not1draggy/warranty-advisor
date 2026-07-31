/**
 * Tests for the deployment diagnostics endpoint.
 *
 * The point of `/api/v1/health` is that it is trustworthy when everything else
 * is uncertain, so these cover the failure paths as carefully as the happy one:
 * every check must fail closed, name itself in Slovak, and never disclose the
 * key it is reporting on.
 *
 * Lives outside `netlify/functions/` because Netlify deploys everything there
 * as a function.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blobs = vi.hoisted(() => ({
  setJSON: vi.fn(),
  get: vi.fn(),
}));

const store = vi.hoisted(() => ({
  log: vi.fn(),
  allowRequest: vi.fn(),
  clientIp: vi.fn(() => "1.2.3.4"),
  // The check writes a probe job and reads it straight back, because that
  // read-after-write is exactly what failed in production.
  writeJob: vi.fn(),
  readJob: vi.fn(),
}));

vi.mock("@netlify/blobs", () => ({ getStore: () => blobs }));
vi.mock("../lib/store", () => store);

const { default: handler } = await import("../functions/health.mjs");

const ENDPOINT = "https://example.com/api/v1/health";
const get = () => new Request(ENDPOINT);

/** Blobs round-trips whatever was written, so the probe reads its own stamp. */
function workingStorage() {
  let written: unknown = null;
  blobs.setJSON.mockImplementation(async (_key: string, value: unknown) => {
    written = value;
  });
  blobs.get.mockImplementation(async () => written);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "sk-ant-secret-value";
  store.allowRequest.mockResolvedValue(true);
  store.writeJob.mockResolvedValue(undefined);
  store.readJob.mockImplementation(async (id: string) => ({ id }));
  workingStorage();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 400 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
});

describe("GET /api/v1/health", () => {
  it("reports ready when the key, storage and worker are all in place", async () => {
    const response = await handler(get());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ready: true,
      checks: { analysisKey: true, storage: true, worker: true },
      detail: "Živá analýza je pripravená.",
    });
  });

  it("never lets a stale answer stand in for a live check", async () => {
    const response = await handler(get());
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("pokes the worker without paying for a research run", async () => {
    await handler(get());

    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("/.netlify/functions/analyze-background");
    // No job id: the worker rejects it before reaching the model.
    expect(JSON.parse(init.body as string)).toEqual({});
  });

  it("names the missing key rather than just refusing to be ready", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const response = await handler(get());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.checks).toMatchObject({ analysisKey: false, storage: true, worker: true });
    expect(body.detail).toContain("ANTHROPIC_API_KEY");
  });

  it("reports storage as broken when the probe does not come back", async () => {
    // Blobs can be reachable and still not persist, which is the harder case.
    blobs.get.mockResolvedValue({ stamp: 1 });

    const body = await (await handler(get())).json();

    expect(body.checks.storage).toBe(false);
    expect(body.detail).toContain("Úložisko úloh");
  });

  it("reports storage as broken when Blobs is not provisioned at all", async () => {
    blobs.setJSON.mockRejectedValue(new Error("blob store unavailable"));

    const body = await (await handler(get())).json();

    expect(body.checks.storage).toBe(false);
  });

  it("catches a job that cannot be read back the instant it is written", async () => {
    // The fault that broke every analysis: the write succeeds, the read a
    // moment later comes back empty, and the browser concludes the work
    // vanished. A probe store round trip alone would not have seen it.
    store.readJob.mockResolvedValue(null);

    const body = await (await handler(get())).json();

    expect(body.checks.storage).toBe(false);
    expect(body.detail).toContain("nedá načítať");
  });

  it("reports the worker as missing when it was never deployed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const body = await (await handler(get())).json();

    expect(body.checks.worker).toBe(false);
    expect(body.detail).toContain("pozadí");
  });

  it("counts any answer other than 404 as a deployed worker", async () => {
    // The worker rejects the empty body — that it rejected it is the proof.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    const body = await (await handler(get())).json();

    expect(body.checks.worker).toBe(true);
  });

  it("reports the worker as missing when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const body = await (await handler(get())).json();

    expect(body.checks.worker).toBe(false);
  });

  it("lists every problem at once, so one fix does not reveal the next", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    blobs.setJSON.mockRejectedValue(new Error("blob store unavailable"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const response = await handler(get());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.checks).toEqual({ analysisKey: false, storage: false, worker: false });
    expect(body.detail).toContain("ANTHROPIC_API_KEY");
    expect(body.detail).toContain("Úložisko úloh");
    expect(body.detail).toContain("pozadí");
  });

  it("discloses that a key exists, never what it is", async () => {
    const body = await (await handler(get())).text();

    expect(body).not.toContain("sk-ant-secret-value");
    expect(body).not.toContain("secret");
  });

  it("stops a caller spending the site's function quota", async () => {
    // Each check costs a background-function invocation, and the endpoint is
    // unauthenticated — without this it is free amplification.
    store.allowRequest.mockResolvedValue(false);

    const response = await handler(get());

    expect(response.status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still answers when the limiter itself is what is broken", async () => {
    // The limiter writes to Blobs, and Blobs being down is one of the faults
    // this endpoint exists to report. Refusing then would hide it.
    store.allowRequest.mockRejectedValue(new Error("blob store unavailable"));
    blobs.setJSON.mockRejectedValue(new Error("blob store unavailable"));

    const response = await handler(get());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.checks.storage).toBe(false);
  });

  it("refuses anything but a read", async () => {
    const response = await handler(new Request(ENDPOINT, { method: "POST" }));

    expect(response.status).toBe(405);
    // A probe that writes on POST would be a denial-of-service lever.
    expect(fetch).not.toHaveBeenCalled();
    expect(blobs.setJSON).not.toHaveBeenCalled();
  });
});
