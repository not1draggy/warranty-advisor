/**
 * Analysis client.
 *
 * Research runs as a background job, so the client creates one and polls it.
 * When no API key is configured the endpoint reports itself unavailable and we
 * fall back to the demo analyses so the interface still works end to end.
 */

import type { AnalysisEvidence } from "../../shared/analysis";
import { findDemoAnalysis } from "../data/demoAnalyses";

export type FailureReason =
  | "unavailable"
  | "rate_limited"
  | "daily_limit"
  | "timeout"
  | "network"
  | "refused"
  | "still_running"
  | "not_a_product"
  | "unusable_response"
  | "upstream_error";

export type AnalysisOutcome =
  | { status: "ready"; evidence: AnalysisEvidence; live: boolean }
  | { status: "failed"; reason: FailureReason };

interface JobResponse {
  id?: string;
  status?: "pending" | "ready" | "failed";
  evidence?: AnalysisEvidence;
  reason?: string;
  error?: string;
}

const ENDPOINT = "/api/v1/analyses";
const POLL_INTERVAL_MS = 2_500;
/**
 * How many consecutive "not found" replies to ride out before calling it a
 * fault.
 *
 * A job cannot legitimately disappear while this loop is running: the server
 * keeps a pending job for longer than the client is willing to wait, and the
 * only id ever polled is one this client just created. So a 404 here means the
 * write is not visible yet, not that the work is gone — and giving up on the
 * first one made every single analysis fail.
 */
const MAX_MISSING_POLLS = 12;
/**
 * How long the interface waits before offering a retry. Deliberately shorter
 * than the server's job timeout: giving up here must not make the job look
 * abandoned, or retrying would start a second, duplicate research run.
 */
export const POLL_TIMEOUT_MS = 5 * 60 * 1000;

const FAILURE_REASONS: readonly FailureReason[] = [
  "unavailable",
  "rate_limited",
  "daily_limit",
  "timeout",
  "network",
  "refused",
  "still_running",
  "not_a_product",
  "unusable_response",
  "upstream_error",
];

function toFailureReason(value: unknown): FailureReason {
  return typeof value === "string" && (FAILURE_REASONS as readonly string[]).includes(value)
    ? (value as FailureReason)
    : "upstream_error";
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

/** Demo evidence, used whenever live research is not configured. */
function demoOutcome(product: string): AnalysisOutcome {
  const evidence = findDemoAnalysis(product);
  return evidence
    ? { status: "ready", evidence, live: false }
    : { status: "failed", reason: "unavailable" };
}

async function poll(id: string, signal: AbortSignal): Promise<AnalysisOutcome> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let missing = 0;

  while (Date.now() < deadline) {
    await wait(POLL_INTERVAL_MS, signal);

    let response: Response;
    try {
      response = await fetch(`${ENDPOINT}/${id}`, { signal });
    } catch (error) {
      if (signal.aborted) throw error;
      // Without this the poll loop would throw and leave the UI mid-analysis.
      return { status: "failed", reason: "network" };
    }

    // Not yet visible rather than gone — see MAX_MISSING_POLLS. Only a long
    // run of these is a real fault, and it is a storage fault, not a timeout.
    if (response.status === 404) {
      missing += 1;
      if (missing >= MAX_MISSING_POLLS) return { status: "failed", reason: "upstream_error" };
      continue;
    }
    missing = 0;

    if (!response.ok) return { status: "failed", reason: "upstream_error" };

    // A 200 that is not JSON means something answered in the API's place —
    // typically a catch-all redirect serving the app shell. Parsing would
    // throw and strand the interface mid-analysis.
    const job = (await response.json().catch(() => null)) as JobResponse | null;
    if (!job) return { status: "failed", reason: "upstream_error" };
    if (job.status === "ready" && job.evidence) {
      return { status: "ready", evidence: job.evidence, live: true };
    }
    if (job.status === "failed") {
      return { status: "failed", reason: toFailureReason(job.reason) };
    }
  }

  // The loop only reaches here having just seen the job pending: every other
  // status returns early. The work is still going, so say that rather than
  // implying it died.
  return { status: "failed", reason: "still_running" };
}

export async function analyze(product: string, signal: AbortSignal): Promise<AnalysisOutcome> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: product }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    return { status: "failed", reason: "network" };
  }

  // 503 = no API key configured; 404 = functions not deployed at all. Both
  // mean live research is unavailable here, so fall back to the demo catalogue.
  if (response.status === 503 || response.status === 404) return demoOutcome(product);
  // Two different 429s: this visitor is going too fast, or the site has spent
  // its research budget for the day. Only one of them is worth retrying.
  if (response.status === 429) {
    const body = (await response.json().catch(() => null)) as JobResponse | null;
    return {
      status: "failed",
      reason: body?.error === "daily_limit" ? "daily_limit" : "rate_limited",
    };
  }
  if (!response.ok) return { status: "failed", reason: "upstream_error" };

  const job = (await response.json().catch(() => null)) as JobResponse | null;
  if (!job) return { status: "failed", reason: "upstream_error" };
  if (job.status === "ready" && job.evidence) {
    return { status: "ready", evidence: job.evidence, live: true };
  }
  if (job.status === "failed") {
    return { status: "failed", reason: toFailureReason(job.reason) };
  }
  if (!job.id) return { status: "failed", reason: "upstream_error" };

  return poll(job.id, signal);
}
