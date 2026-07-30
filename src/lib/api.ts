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
  | "timeout"
  | "network"
  | "refused"
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
 * How long the interface waits before offering a retry. Deliberately shorter
 * than the server's job timeout: giving up here must not make the job look
 * abandoned, or retrying would start a second, duplicate research run.
 */
export const POLL_TIMEOUT_MS = 5 * 60 * 1000;

const FAILURE_REASONS: readonly FailureReason[] = [
  "unavailable",
  "rate_limited",
  "timeout",
  "network",
  "refused",
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

    // A job that aged out of the store is indistinguishable from one that
    // never finished; either way the user should be able to retry.
    if (response.status === 404) return { status: "failed", reason: "timeout" };
    if (!response.ok) return { status: "failed", reason: "upstream_error" };

    const job = (await response.json()) as JobResponse;
    if (job.status === "ready" && job.evidence) {
      return { status: "ready", evidence: job.evidence, live: true };
    }
    if (job.status === "failed") {
      return { status: "failed", reason: toFailureReason(job.reason) };
    }
  }

  return { status: "failed", reason: "timeout" };
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
  if (response.status === 429) return { status: "failed", reason: "rate_limited" };
  if (!response.ok) return { status: "failed", reason: "upstream_error" };

  const job = (await response.json()) as JobResponse;
  if (job.status === "ready" && job.evidence) {
    return { status: "ready", evidence: job.evidence, live: true };
  }
  if (job.status === "failed") {
    return { status: "failed", reason: toFailureReason(job.reason) };
  }
  if (!job.id) return { status: "failed", reason: "upstream_error" };

  return poll(job.id, signal);
}
