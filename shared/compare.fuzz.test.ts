/**
 * Property sweep over the comparison.
 *
 * Two bugs in this file appeared only with three candidates, and neither was
 * reachable from the cases I thought to write by hand: one where the cheapest
 * of an indistinguishable set sat in third place and was passed over, and one
 * where the table marked a winner the headline had declined to name.
 *
 * The invariant that matters is that the recommendation is never dominated —
 * there must be no candidate that is better on the terms the comparison
 * itself claims to use. The generator is seeded, so a failure is reproducible
 * rather than a flake.
 */

import { describe, expect, it } from "vitest";
import type { AnalysisEvidence, Difficulty, Rating } from "./analysis";
import {
  compareCandidates,
  COST_NOISE_RATIO,
  RISK_NOISE,
  type Candidate,
  type RankedCandidate,
} from "./compare";

/** Deterministic PRNG (mulberry32) — same sequence on every machine and run. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RATINGS: Rating[] = ["good", "fair", "poor"];
const DIFFICULTIES: Difficulty[] = ["low", "medium", "high"];

function makeCandidate(name: string, random: () => number): Candidate {
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
  const price = Math.round(100 + random() * 2000);
  const low = Math.round(20 + random() * 600);
  const high = low + Math.round(random() * 400);

  const evidence: AnalysisEvidence = {
    product: {
      brand: "Značka",
      model: name,
      // One category throughout: a mixed field is refused by design, and that
      // path is covered by its own tests.
      category: "Práčka",
      releaseYear: 2022,
      specs: [],
      matchLevel: pick(["exact", "family", "category"] as const),
      estimatedPrice: price,
      priceBasis: "estimate",
      serviceLifeYears: Math.round(3 + random() * 15),
    },
    evidenceNote: "",
    failures: Array.from({ length: 1 + Math.floor(random() * 3) }, (_, i) => ({
      component: `Diel ${i}`,
      description: "",
      riskLevel: "medium" as const,
      probability: Math.round(1 + random() * 90),
      frequency: "",
      onsetYears: random() < 0.5 ? null : ([1 + random() * 8, 4 + random() * 10] as [number, number]),
      repairCost: [low, high] as [number, number],
      basis: "estimate" as const,
      difficulty: pick(DIFFICULTIES),
      sourceIds: [],
    })),
    worstCase: { component: "Diel 0", cost: [low, high], note: "" },
    partsAvailability: { rating: pick(RATINGS), note: "" },
    repairDifficulty: { rating: pick(DIFFICULTIES), note: "" },
    strengths: [],
    weaknesses: [],
    serviceExperience: "",
    ownerExperience: "",
    competitors: [],
    goodFor: [],
    notGoodFor: [],
    summary: "",
    sources: [],
  };

  return {
    query: name,
    evidence,
    offeredPrice: random() < 0.3 ? Math.round(80 + random() * 1500) : null,
    warrantyYears: null,
    warrantyPrice: null,
    live: true,
  };
}

const VERDICT_ORDER = { buy: 0, caution: 1, avoid: 2 } as const;

/**
 * Is `rival` better than `winner` on the comparison's own stated terms?
 *
 * Anything this finds is a recommendation the reader could refute by reading
 * the very table printed beneath it.
 */
function dominates(rival: RankedCandidate, winner: RankedCandidate): string | null {
  if (VERDICT_ORDER[rival.score.verdict] < VERDICT_ORDER[winner.score.verdict]) {
    return `${rival.query} has the better verdict`;
  }
  if (rival.score.verdict !== winner.score.verdict) return null;

  const riskGap = winner.score.ownershipRisk - rival.score.ownershipRisk;
  if (riskGap >= RISK_NOISE) return `${rival.query} is clearly less risky`;

  // Risk could not separate them, so cost decides — this is the bug that
  // shipped, where a cheaper equal-risk candidate in third place was skipped.
  if (
    Math.abs(riskGap) < RISK_NOISE &&
    winner.totalCost - rival.totalCost > Math.max(1, rival.totalCost) * COST_NOISE_RATIO
  ) {
    return `${rival.query} costs meaningfully less at the same risk`;
  }
  return null;
}

const ITERATIONS = 2_000;

describe("compareCandidates over random fields", () => {
  it("never recommends a candidate another one beats on its own terms", () => {
    const random = rng(20260730);

    for (let i = 0; i < ITERATIONS; i += 1) {
      const size = 2 + Math.floor(random() * 2);
      const field = Array.from({ length: size }, (_, n) => makeCandidate(`P${n}`, random));
      const result = compareCandidates(field, new Date("2026-07-30T00:00:00Z"));
      if (!result.winner) continue;

      for (const rival of result.candidates) {
        if (rival.query === result.winner.query) continue;
        expect(dominates(rival, result.winner), `iteration ${i}`).toBeNull();
      }
    }
  });

  it("keeps the field intact and always explains itself", () => {
    const random = rng(19700101);

    for (let i = 0; i < ITERATIONS; i += 1) {
      const size = 2 + Math.floor(random() * 2);
      const field = Array.from({ length: size }, (_, n) => makeCandidate(`P${n}`, random));
      const result = compareCandidates(field, new Date("2026-07-30T00:00:00Z"));
      const where = `iteration ${i}`;

      // Nothing may be dropped or duplicated by the reordering.
      expect(result.candidates, where).toHaveLength(size);
      expect(new Set(result.candidates.map((c) => c.query)).size, where).toBe(size);

      // The winner has to be one of the products actually assessed.
      if (result.winner) {
        expect(result.candidates.map((c) => c.query), where).toContain(result.winner.query);
        expect(result.candidates[0].query, where).toBe(result.winner.query);
      }

      // A comparison that says nothing is a comparison the reader cannot use.
      expect(result.reasons.length, where).toBeGreaterThan(0);
      expect(
        result.reasons.every((reason) => reason.trim().length > 0),
        where,
      ).toBe(true);

      // Ranks run in order and never improve further down the list.
      const ranks = result.candidates.map((c) => c.rank);
      for (let n = 1; n < ranks.length; n += 1) {
        expect(ranks[n], where).toBeGreaterThanOrEqual(ranks[n - 1]);
      }
    }
  });
});
