/**
 * Deterministic comparison of two or three candidates.
 *
 * Like the verdict itself, the recommendation of which one to buy is computed
 * from the evidence rather than asked for — the model never sees the other
 * products and is never invited to pick a winner.
 *
 * The hard part is honesty about closeness. These estimates carry real
 * uncertainty, so declaring a winner on a two-point difference in ownership
 * risk would dress noise up as a finding. When the candidates are genuinely
 * close this says so and moves the decision onto the ground that is actually
 * solid: what each one costs.
 */

import type { AnalysisEvidence } from "./analysis";
import { costOfOwnership, scoreAnalysis, type Score, type VerdictKind } from "./scoring";

export interface Candidate {
  /** The product text the user typed, used as a stable key and label. */
  query: string;
  evidence: AnalysisEvidence;
  /** Price the buyer was offered for this one, if they gave one. */
  offeredPrice: number | null;
  /** Terms of an extended warranty the buyer is weighing for this one. */
  warrantyYears: number | null;
  warrantyPrice: number | null;
  /** False for a demo analysis, which must never be presented as researched. */
  live: boolean;
}

export interface RankedCandidate extends Candidate {
  score: Score;
  /** Price plus expected repairs, in EUR — the figure ranking falls back on. */
  totalCost: number;
  /** 1 for the recommendation; equal ranks mean too close to separate. */
  rank: number;
}

export type ComparisonBasis =
  | "verdict"
  | "risk"
  /** Risks too close to separate, so the cheaper total decided it. */
  | "cost"
  /** Nothing meaningfully separates them. */
  | "tie"
  /** Not alternatives to each other, so there is nothing to choose between. */
  | "incomparable";

export interface Comparison {
  /** Best first; equal `rank` values mean the pair could not be separated. */
  candidates: RankedCandidate[];
  /** The one to buy, or `null` when nothing separates the field. */
  winner: RankedCandidate | null;
  basis: ComparisonBasis;
  /** Plain-Slovak justification, in the same register as a single verdict. */
  reasons: string[];
}

/** Ownership-risk points below which two products are the same product. */
const RISK_NOISE = 6;
/** Total-cost difference below which the cheaper one is not actually cheaper. */
const COST_NOISE_RATIO = 0.05;

const VERDICT_ORDER: Record<VerdictKind, number> = { buy: 0, caution: 1, avoid: 2 };

const eur = (n: number) => `${Math.round(n).toLocaleString("sk-SK")} €`;

function label(candidate: Candidate): string {
  const { brand, model } = candidate.evidence.product;
  return brand && !model.toLowerCase().startsWith(brand.toLowerCase())
    ? `${brand} ${model}`
    : model;
}

function rank(candidates: RankedCandidate[]): void {
  candidates.sort(
    (a, b) =>
      VERDICT_ORDER[a.score.verdict] - VERDICT_ORDER[b.score.verdict] ||
      a.score.ownershipRisk - b.score.ownershipRisk ||
      a.totalCost - b.totalCost,
  );

  // Candidates that nothing meaningfully separates share a rank, so the
  // interface can show a genuine draw rather than an arbitrary order.
  let current = 1;
  candidates.forEach((candidate, index) => {
    if (index === 0) {
      candidate.rank = 1;
      return;
    }
    const previous = candidates[index - 1];
    const separated =
      previous.score.verdict !== candidate.score.verdict ||
      Math.abs(previous.score.ownershipRisk - candidate.score.ownershipRisk) >= RISK_NOISE;

    if (separated) current = index + 1;
    candidate.rank = current;
  });
}

function explain(best: RankedCandidate, runnerUp: RankedCandidate, basis: ComparisonBasis): string[] {
  const reasons: string[] = [];
  const bestName = label(best);
  const otherName = label(runnerUp);

  switch (basis) {
    case "verdict":
      reasons.push(
        `${bestName} má lepšie celkové hodnotenie než ${otherName}, a to je rozdiel, ` +
          "ktorý neprekryje ani nižšia cena.",
      );
      break;
    case "risk":
      reasons.push(
        `${bestName} má nižšie riziko vlastníctva — ${best.score.ownershipRisk} oproti ` +
          `${runnerUp.score.ownershipRisk} zo 100.`,
      );
      break;
    case "cost":
      reasons.push(
        `Riziko oboch výrobkov je prakticky rovnaké (${best.score.ownershipRisk} a ` +
          `${runnerUp.score.ownershipRisk} zo 100), takže rozhoduje cena.`,
      );
      reasons.push(
        `${bestName} vyjde aj s očakávanými opravami na ${eur(best.totalCost)}, ` +
          `${otherName} na ${eur(runnerUp.totalCost)}.`,
      );
      break;
    case "tie":
      reasons.push(
        `${bestName} a ${otherName} vychádzajú z tohto porovnania rovnako — rizikom aj ` +
          "celkovými nákladmi. Rozhodnúť môžu vlastnosti, ktoré sa nedajú vyčísliť.",
      );
      break;
  }

  // Confidence never decides the winner, but a reader deserves to know when
  // the two assessments do not rest on comparable evidence.
  const gap = best.score.confidence - runnerUp.score.confidence;
  if (Math.abs(gap) >= 20) {
    const [betterKnown, lesserKnown] = gap > 0 ? [bestName, otherName] : [otherName, bestName];
    reasons.push(
      `K výrobku ${betterKnown} je podstatne viac servisných podkladov než k ${lesserKnown}, ` +
        "takže jeho odhad stojí na pevnejšom základe.",
    );
  }

  return reasons;
}

/**
 * Ranks candidates and says which to buy.
 *
 * @param now Injected so the confidence dates are reproducible in tests.
 */
export function compareCandidates(candidates: Candidate[], now: Date = new Date()): Comparison {
  const ranked: RankedCandidate[] = candidates.map((candidate) => ({
    ...candidate,
    score: scoreAnalysis(candidate.evidence, now),
    totalCost: costOfOwnership(candidate.evidence, candidate.offeredPrice).total,
    rank: 1,
  }));

  rank(ranked);

  if (ranked.length < 2) {
    return { candidates: ranked, winner: ranked[0] ?? null, basis: "verdict", reasons: [] };
  }

  const [best, runnerUp] = ranked;

  // Nobody chooses between a washing machine and a television. Ranking them
  // would produce a confident recommendation about a decision the buyer is not
  // making, which is worse than declining — the figures still stand on their
  // own, so they are shown without a winner on top of them.
  const categories = new Set(
    ranked.map((c) => c.evidence.product.category.trim().toLowerCase()).filter(Boolean),
  );
  if (categories.size > 1) {
    return {
      candidates: ranked,
      winner: null,
      basis: "incomparable",
      reasons: [
        `Tieto výrobky nie sú vzájomné alternatívy — ide o rôzne kategórie ` +
          `(${ranked.map((c) => c.evidence.product.category).join(", ")}). ` +
          "Každý má vlastné hodnotenie, ale nedá sa povedať, ktorý z nich kúpiť namiesto druhého.",
      ],
    };
  }

  let basis: ComparisonBasis;
  if (best.score.verdict !== runnerUp.score.verdict) {
    basis = "verdict";
  } else if (Math.abs(best.score.ownershipRisk - runnerUp.score.ownershipRisk) >= RISK_NOISE) {
    basis = "risk";
  } else {
    const cheaper = Math.min(best.totalCost, runnerUp.totalCost);
    const spread = Math.abs(best.totalCost - runnerUp.totalCost);
    basis = spread > Math.max(1, cheaper) * COST_NOISE_RATIO ? "cost" : "tie";
  }

  // On cost the ordering above may have the wrong one first: it sorts on risk
  // before cost, and here risk has just been ruled a draw.
  if (basis === "cost" && runnerUp.totalCost < best.totalCost) {
    ranked[0] = runnerUp;
    ranked[1] = best;
    ranked[0].rank = 1;
    ranked[1].rank = 1;
  }

  const [first, second] = ranked;
  return {
    candidates: ranked,
    winner: basis === "tie" ? null : first,
    basis,
    reasons: explain(first, second, basis),
  };
}
