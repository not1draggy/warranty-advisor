/**
 * Tests for the analysis client.
 *
 * This module decides what the user sees when things go wrong, and most of its
 * outcomes are only reachable through failures that are awkward to reproduce by
 * hand — a job that ages out, a network blip mid-poll, a run that outlives the
 * client's patience. Each of those maps to a different thing the interface
 * tells someone, so each is worth pinning down.
 *
 * The poll loop sleeps between attempts, so these run on fake timers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyze, POLL_TIMEOUT_MS } from "./api";

/** A product the demo catalogue knows, for the no-key fallback path. */
const DEMO_PRODUCT = "Bosch WAN28160BY";

const evidence = { product: { model: "WAN28160BY" } };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Queues one response per call, repeating the last one once exhausted. */
function respondWith(...responses: Response[]) {
  let index = 0;
  const urls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    urls.push(String(input));
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return response.clone();
  });
  vi.stubGlobal("fetch", fetchMock);
  return Object.assign(fetchMock, { urls });
}

/** Runs `analyze` to completion, letting the poll loop's sleeps elapse. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const raced = promise.then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );

  for (let i = 0; i < 200; i += 1) {
    const outcome = await Promise.race([raced, Promise.resolve(null)]);
    if (outcome) {
      if (outcome.ok) return outcome.value;
      throw outcome.error;
    }
    await vi.advanceTimersByTimeAsync(2_500);
  }
  throw new Error("analyze never settled");
}

let controller: AbortController;

beforeEach(() => {
  vi.useFakeTimers();
  controller = new AbortController();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("when live research is not configured", () => {
  it("falls back to a demo analysis and says it is not live", async () => {
    respondWith(json({ error: "live_analysis_unavailable" }, 503));

    const outcome = await analyze(DEMO_PRODUCT, controller.signal);

    expect(outcome).toMatchObject({ status: "ready", live: false });
  });

  it("falls back the same way when the functions are not deployed", async () => {
    respondWith(new Response(null, { status: 404 }));

    expect(await analyze(DEMO_PRODUCT, controller.signal)).toMatchObject({
      status: "ready",
      live: false,
    });
  });

  it("reports the product as unavailable when the demo catalogue has no answer", async () => {
    respondWith(json({ error: "live_analysis_unavailable" }, 503));

    expect(await analyze("Neznáma značka XYZ999", controller.signal)).toEqual({
      status: "failed",
      reason: "unavailable",
    });
  });
});

describe("when the request itself fails", () => {
  it("reports a refused request as a network problem", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    expect(await analyze(DEMO_PRODUCT, controller.signal)).toEqual({
      status: "failed",
      reason: "network",
    });
  });

  it("passes an abort through instead of reporting it as a failure", async () => {
    // A newer search owns the view now, so this one must vanish silently.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        controller.abort();
        return Promise.reject(new DOMException("aborted", "AbortError"));
      }),
    );

    await expect(analyze(DEMO_PRODUCT, controller.signal)).rejects.toThrow();
  });

  it("distinguishes being asked to slow down from a fault", async () => {
    respondWith(json({ error: "rate_limited" }, 429));

    expect(await analyze(DEMO_PRODUCT, controller.signal)).toEqual({
      status: "failed",
      reason: "rate_limited",
    });
  });

  it("tells a spent daily budget apart from an impatient visitor", async () => {
    // Both are 429, but one clears in a minute and the other does not clear
    // today — offering the same "try again" for both would be a lie.
    respondWith(json({ error: "daily_limit" }, 429));

    expect(await analyze(DEMO_PRODUCT, controller.signal)).toEqual({
      status: "failed",
      reason: "daily_limit",
    });
  });

  it("treats a 429 with no explanation as ordinary rate limiting", async () => {
    respondWith(new Response(null, { status: 429 }));

    expect(await analyze(DEMO_PRODUCT, controller.signal)).toEqual({
      status: "failed",
      reason: "rate_limited",
    });
  });

  it("treats any other error status as an upstream fault", async () => {
    respondWith(json({ error: "internal_error" }, 500));

    expect(await analyze(DEMO_PRODUCT, controller.signal)).toEqual({
      status: "failed",
      reason: "upstream_error",
    });
  });
});

describe("when the analysis is already known", () => {
  it("returns a cached result without polling", async () => {
    const fetchMock = respondWith(json({ id: "job-1", status: "ready", evidence }));

    const outcome = await analyze(DEMO_PRODUCT, controller.signal);

    expect(outcome).toMatchObject({ status: "ready", live: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes a known failure reason straight through to the interface", async () => {
    respondWith(json({ id: "job-1", status: "failed", reason: "not_a_product" }));

    expect(await analyze("stolička", controller.signal)).toEqual({
      status: "failed",
      reason: "not_a_product",
    });
  });

  it("does not invent a reason the interface cannot explain", async () => {
    // An unrecognised code would otherwise reach a lookup that has no Slovak
    // wording for it, and the user would be shown nothing at all.
    respondWith(json({ id: "job-1", status: "failed", reason: "something_new" }));

    expect(await analyze(DEMO_PRODUCT, controller.signal)).toEqual({
      status: "failed",
      reason: "upstream_error",
    });
  });

  it("treats a response with no job id as a fault rather than polling nothing", async () => {
    respondWith(json({ status: "pending" }));

    expect(await analyze(DEMO_PRODUCT, controller.signal)).toEqual({
      status: "failed",
      reason: "upstream_error",
    });
  });
});

describe("while polling a running job", () => {
  it("waits through pending replies and returns the finished analysis", async () => {
    const fetchMock = respondWith(
      json({ id: "job-1", status: "pending" }, 202),
      json({ id: "job-1", status: "pending" }),
      json({ id: "job-1", status: "pending" }),
      json({ id: "job-1", status: "ready", evidence }),
    );

    const outcome = await settle(analyze(DEMO_PRODUCT, controller.signal));

    expect(outcome).toMatchObject({ status: "ready", live: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.urls[1]).toBe("/api/v1/analyses/job-1");
  });

  it("waits out a job that is not visible yet instead of declaring it gone", async () => {
    // This is the bug that made every single analysis fail in production.
    // Blobs reads are eventually consistent, so the job written a moment ago
    // can read back as missing — and the client gave up on the first 404.
    const fetchMock = respondWith(
      json({ id: "job-1", status: "pending" }, 202),
      new Response(null, { status: 404 }),
      new Response(null, { status: 404 }),
      new Response(null, { status: 404 }),
      json({ id: "job-1", status: "ready", evidence }),
    );

    const outcome = await settle(analyze(DEMO_PRODUCT, controller.signal));

    expect(outcome).toMatchObject({ status: "ready", live: true });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("calls a job missing for long enough a storage fault, not a timeout", async () => {
    // A pending job outlives the client's patience by design, and the only id
    // polled is one this client just created, so it cannot legitimately age
    // out mid-loop. Sustained absence is a fault worth reporting as one.
    respondWith(json({ id: "job-1", status: "pending" }, 202), new Response(null, { status: 404 }));

    expect(await settle(analyze(DEMO_PRODUCT, controller.signal))).toEqual({
      status: "failed",
      reason: "upstream_error",
    });
  });

  it("forgives a single blip once the job reappears", async () => {
    const fetchMock = respondWith(
      json({ id: "job-1", status: "pending" }, 202),
      new Response(null, { status: 404 }),
      json({ id: "job-1", status: "pending" }),
      new Response(null, { status: 404 }),
      json({ id: "job-1", status: "ready", evidence }),
    );

    expect(await settle(analyze(DEMO_PRODUCT, controller.signal))).toMatchObject({
      status: "ready",
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("survives a network blip mid-poll instead of stranding the spinner", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 1) return json({ id: "job-1", status: "pending" }, 202);
        throw new TypeError("Failed to fetch");
      }),
    );

    expect(await settle(analyze(DEMO_PRODUCT, controller.signal))).toEqual({
      status: "failed",
      reason: "network",
    });
  });

  it("reports a poll fault without claiming the analysis itself failed", async () => {
    respondWith(json({ id: "job-1", status: "pending" }, 202), new Response(null, { status: 502 }));

    expect(await settle(analyze(DEMO_PRODUCT, controller.signal))).toEqual({
      status: "failed",
      reason: "upstream_error",
    });
  });

  it("says the run is still going rather than calling it a timeout", async () => {
    // The distinction is not cosmetic: the server's job outlives the client's
    // patience on purpose, so a retry here would pay for a second research run
    // of a job that is still working.
    respondWith(json({ id: "job-1", status: "pending" }, 202));

    const outcome = await settle(analyze(DEMO_PRODUCT, controller.signal));

    expect(outcome).toEqual({ status: "failed", reason: "still_running" });
  });

  it("gives up only after the full waiting period", async () => {
    respondWith(json({ id: "job-1", status: "pending" }, 202));
    const started = Date.now();

    await settle(analyze(DEMO_PRODUCT, controller.signal));

    expect(Date.now() - started).toBeGreaterThanOrEqual(POLL_TIMEOUT_MS);
  });

  it("abandons the poll when a newer search takes over", async () => {
    respondWith(json({ id: "job-1", status: "pending" }, 202));

    const running = analyze(DEMO_PRODUCT, controller.signal);
    const settled = settle(running);
    await vi.advanceTimersByTimeAsync(2_500);
    controller.abort(new DOMException("aborted", "AbortError"));

    await expect(settled).rejects.toThrow();
  });
});
