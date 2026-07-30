/**
 * Turns what the API returned into what the interface should show.
 *
 * This lived inside the component, where it was the one piece of real branching
 * logic in the app with no test around it: partial failures in a comparison, a
 * field of candidates reduced to one, and choosing which failure to report when
 * several arrive at once. Pulling it out costs nothing and makes each of those
 * decisions checkable.
 */

import type { AnalysisEvidence } from "../../shared/analysis";
import type { Candidate } from "../../shared/compare";
import type { AnalysisOutcome, FailureReason } from "./api";
import type { ParsedQuery } from "./query";

export type Resolution =
  | { kind: "ready"; evidence: AnalysisEvidence; query: ParsedQuery; live: boolean }
  | { kind: "compared"; candidates: Candidate[] }
  | { kind: "failed"; reason: FailureReason };

/**
 * @param parts   The candidates the query asked about, in the order typed.
 * @param outcomes One per part, in the same order.
 */
export function resolveOutcomes(parts: ParsedQuery[], outcomes: AnalysisOutcome[]): Resolution {
  const candidates: Candidate[] = [];

  parts.forEach((part, index) => {
    const outcome = outcomes[index];
    if (outcome?.status !== "ready") return;
    candidates.push({
      query: part.product,
      evidence: outcome.evidence,
      offeredPrice: part.price,
      warrantyYears: part.warrantyYears,
      warrantyPrice: part.warrantyPrice,
      live: outcome.live,
    });
  });

  if (candidates.length === 0) {
    // Report a real reason rather than a generic fault. Several may have
    // failed differently; the first is the one the user asked about first.
    const failed = outcomes.find((outcome) => outcome?.status === "failed");
    return {
      kind: "failed",
      reason: failed?.status === "failed" ? failed.reason : "upstream_error",
    };
  }

  // One survivor out of a comparison is an analysis, not a comparison.
  // Presenting it as one would imply a verdict against something never
  // assessed — the reader would take the missing candidate as the worse buy.
  if (candidates.length === 1) {
    const [only] = candidates;
    return {
      kind: "ready",
      evidence: only.evidence,
      query: parts.find((part) => part.product === only.query) ?? parts[0],
      live: only.live,
    };
  }

  return { kind: "compared", candidates };
}
