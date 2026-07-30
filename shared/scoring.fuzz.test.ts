/**
 * Property sweep over the scoring.
 *
 * Hand-picked cases check the calibration I had in mind. These check the
 * relationships that must hold whatever the numbers, and particularly the
 * monotonic ones — that making a product worse can never improve its rating.
 * Those are the properties a recalibration is most likely to break, and the
 * risk slope has already been retuned once.
 *
 * Seeded, so a failure is reproducible rather than a flake.
 */

import { describe, expect, it } from "vitest";
import type { AnalysisEvidence, Difficulty, Failure, Rating, SourceAuthority } from "./analysis";
import {
  assessWarranty,
  confidence,
  costOfOwnership,
  expectedRepairCost,
  ownershipRisk,
  scoreAnalysis,
  STATUTORY_WARRANTY_YEARS,
} from "./scoring";

const NOW = new Date("2026-07-30T00:00:00Z");

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
const AUTHORITIES: SourceAuthority[] = [
  "authorized_service",
  "service_manual",
  "repair_shop",
  "forum",
  "community",
];

function makeEvidence(random: () => number): AnalysisEvidence {
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
  const failures: Failure[] = Array.from(
    { length: 1 + Math.floor(random() * 5) },
    (_, i): Failure => {
      const low = Math.round(random() * 800);
      const from = Math.round(random() * 12);
      return {
        component: `Diel ${i}`,
        description: "",
        riskLevel: pick(["high", "medium", "low"] as const),
        probability: Math.round(1 + random() * 94),
        frequency: "",
        onsetYears: random() < 0.4 ? null : [from, from + Math.round(random() * 8)],
        repairCost: [low, low + Math.round(random() * 500)],
        basis: "estimate",
        difficulty: pick(DIFFICULTIES),
        sourceIds: random() < 0.5 ? ["s1"] : [],
      };
    },
  );

  const worst = [...failures].sort((a, b) => b.repairCost[1] - a.repairCost[1])[0];

  return {
    product: {
      brand: "Značka",
      model: "M1",
      category: "Práčka",
      releaseYear: 2022,
      specs: [],
      matchLevel: pick(["exact", "family", "category"] as const),
      estimatedPrice: Math.round(1 + random() * 3000),
      priceBasis: "estimate",
      serviceLifeYears: Math.round(2 + random() * 23),
    },
    evidenceNote: "",
    failures,
    worstCase: { component: worst.component, cost: worst.repairCost, note: "" },
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
    sources:
      random() < 0.3
        ? []
        : [
            {
              id: "s1",
              name: "Zdroj",
              url: "https://example.com/a",
              authority: pick(AUTHORITIES),
              date: random() < 0.5 ? "2026-01-15" : null,
            },
          ],
  };
}

const ITERATIONS = 2_000;

describe("scoreAnalysis over random evidence", () => {
  it("always produces a usable, explained rating", () => {
    const random = rng(20260730);

    for (let i = 0; i < ITERATIONS; i += 1) {
      const evidence = makeEvidence(random);
      const score = scoreAnalysis(evidence, NOW);
      const where = `iteration ${i}`;

      expect(score.ownershipRisk, where).toBeGreaterThanOrEqual(0);
      expect(score.ownershipRisk, where).toBeLessThanOrEqual(100);
      expect(Number.isInteger(score.ownershipRisk), where).toBe(true);

      // Confidence never reaches certainty and never bottoms out at nothing.
      expect(score.confidence, where).toBeGreaterThan(0);
      expect(score.confidence, where).toBeLessThan(100);

      // The one outcome the product must never reach is no recommendation.
      expect(["buy", "caution", "avoid"], where).toContain(score.verdict);
      expect(score.reasons.length, where).toBeGreaterThan(0);
      expect(
        score.reasons.every((reason) => reason.trim().length > 0),
        where,
      ).toBe(true);

      const [low, high] = score.typicalRepairCost;
      expect(high, where).toBeGreaterThanOrEqual(low);
      expect(score.expectedRepairCost, where).toBeGreaterThanOrEqual(0);
    }
  });

  it("never rewards a product for getting worse", () => {
    // A recalibration that broke this would make the rating actively
    // misleading rather than merely mistuned.
    const random = rng(19700101);

    for (let i = 0; i < ITERATIONS; i += 1) {
      const evidence = makeEvidence(random);
      const base = ownershipRisk(evidence);
      const where = `iteration ${i}`;

      // A likelier failure cannot lower the risk.
      const likelier: AnalysisEvidence = {
        ...evidence,
        failures: evidence.failures.map((f) => ({
          ...f,
          probability: Math.min(95, f.probability + 5),
        })),
      };
      expect(ownershipRisk(likelier), where).toBeGreaterThanOrEqual(base);

      // Nor can a dearer repair.
      const costlier: AnalysisEvidence = {
        ...evidence,
        failures: evidence.failures.map((f) => ({
          ...f,
          repairCost: [f.repairCost[0], f.repairCost[1] + 50] as [number, number],
        })),
      };
      expect(ownershipRisk(costlier), where).toBeGreaterThanOrEqual(base);

      // A more expensive product carries the same repairs more easily.
      const dearer: AnalysisEvidence = {
        ...evidence,
        product: { ...evidence.product, estimatedPrice: evidence.product.estimatedPrice * 2 },
      };
      expect(ownershipRisk(dearer), where).toBeLessThanOrEqual(base);
    }
  });

  it("never lets thinner evidence raise confidence", () => {
    const random = rng(31415926);

    for (let i = 0; i < ITERATIONS; i += 1) {
      const evidence = makeEvidence(random);
      const stripped: AnalysisEvidence = { ...evidence, sources: [] };

      expect(confidence(stripped, NOW), `iteration ${i}`).toBeLessThanOrEqual(
        confidence(evidence, NOW),
      );
    }
  });
});

describe("assessWarranty over random evidence", () => {
  it("never claims cover beyond the repairs that exist", () => {
    const random = rng(27182818);

    for (let i = 0; i < ITERATIONS; i += 1) {
      const evidence = makeEvidence(random);
      const years = 1 + Math.floor(random() * 5);
      const assessment = assessWarranty(evidence, years, Math.round(random() * 300));
      const where = `iteration ${i}`;

      expect(assessment.expectedCost, where).toBeGreaterThanOrEqual(0);
      // Cover cannot be worth more than every repair the product will ever need.
      expect(assessment.expectedCost, where).toBeLessThanOrEqual(
        Math.ceil(expectedRepairCost(evidence.failures)),
      );

      expect(assessment.coversFrom, where).toBe(STATUTORY_WARRANTY_YEARS);
      expect(assessment.coversTo, where).toBe(STATUTORY_WARRANTY_YEARS + years);
      expect(assessment.note.trim().length, where).toBeGreaterThan(0);
    }
  });

  it("never makes a longer warranty cover less", () => {
    const random = rng(16180339);

    for (let i = 0; i < ITERATIONS; i += 1) {
      const evidence = makeEvidence(random);
      const shorter = assessWarranty(evidence, 2, 100).expectedCost;
      const longer = assessWarranty(evidence, 4, 100).expectedCost;

      expect(longer, `iteration ${i}`).toBeGreaterThanOrEqual(shorter);
    }
  });
});

describe("costOfOwnership over random evidence", () => {
  it("always adds up", () => {
    const random = rng(14142135);

    for (let i = 0; i < ITERATIONS; i += 1) {
      const evidence = makeEvidence(random);
      const offered = random() < 0.5 ? Math.round(random() * 2000) : null;
      const cost = costOfOwnership(evidence, offered);
      const where = `iteration ${i}`;

      expect(cost.total, where).toBe(Math.round(cost.price + cost.repairs));
      expect(cost.price, where).toBeGreaterThan(0);
      expect(cost.marketPrice, where).toBeGreaterThan(0);
      // A stated offer is always the price the buyer is shown.
      if (offered !== null && offered > 0) {
        expect(cost.price, where).toBe(offered);
        expect(cost.priceSource, where).toBe("offered");
      }
    }
  });
});
