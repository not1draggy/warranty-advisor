/**
 * Comparing candidates.
 *
 * The interesting cases are the close ones. A recommendation built on a
 * two-point difference in an estimate is noise presented as a finding, and
 * these estimates are not precise enough to support that.
 */

import { describe, expect, it } from "vitest";
import type { AnalysisEvidence, Failure } from "./analysis";
import { compareCandidates, type Candidate } from "./compare";

const NOW = new Date("2026-07-30T00:00:00Z");

function failure(overrides: Partial<Failure> = {}): Failure {
  return {
    component: "Komponent",
    description: "",
    riskLevel: "medium",
    probability: 20,
    frequency: "",
    onsetYears: null,
    repairCost: [100, 200],
    preventable: false,
    basis: "estimate",
    difficulty: "medium",
    sourceIds: [],
    ...overrides,
  };
}

function evidence(overrides: Partial<AnalysisEvidence> = {}): AnalysisEvidence {
  return {
    product: {
      brand: "Značka",
      model: "M1",
      category: "Práčka",
      releaseYear: 2022,
      specs: [],
      matchLevel: "exact",
      estimatedPrice: 1000,
      priceBasis: "estimate",
      serviceLifeYears: 10,
    },
    evidenceNote: "",
    failures: [failure()],
    worstCase: { component: "Komponent", cost: [100, 200], note: "" },
    partsAvailability: { rating: "good", note: "" },
    repairDifficulty: { rating: "low", note: "" },
    strengths: [],
    weaknesses: [],
    serviceExperience: "",
    ownerExperience: "",
    competitors: [],
    goodFor: [],
    notGoodFor: [],
    summary: "",
    sources: [],
    ...overrides,
  };
}

/** A candidate with a given model name, price and repair burden. */
function candidate(
  model: string,
  { price = 1000, probability = 20, repairCost = [100, 200] as [number, number], ...rest } = {},
): Candidate {
  return {
    query: model,
    offeredPrice: null,
    warrantyYears: null,
    warrantyPrice: null,
    live: true,
    evidence: evidence({
      product: { ...evidence().product, model, estimatedPrice: price },
      failures: [failure({ probability, repairCost })],
      worstCase: { component: "Komponent", cost: repairCost, note: "" },
      ...rest,
    }),
  };
}

describe("picking between candidates", () => {
  it("prefers the better verdict even when the other is cheaper", () => {
    // A cheap product you should not buy is not a bargain.
    const solid = candidate("Dobrý", { price: 1200, probability: 10, repairCost: [80, 120] });
    const risky = candidate("Rizikový", { price: 400, probability: 90, repairCost: [300, 400] });

    const result = compareCandidates([risky, solid], NOW);

    expect(result.winner?.evidence.product.model).toBe("Dobrý");
    expect(result.basis).toBe("verdict");
    expect(result.reasons.join(" ")).toContain("neprekryje ani nižšia cena");
  });

  it("separates candidates on risk when the gap is real", () => {
    const safer = candidate("Bezpečnejší", { probability: 10, repairCost: [80, 120] });
    const worse = candidate("Horší", { probability: 60, repairCost: [250, 350] });

    const result = compareCandidates([worse, safer], NOW);

    expect(result.winner?.evidence.product.model).toBe("Bezpečnejší");
    expect(["risk", "verdict"]).toContain(result.basis);
  });

  it("moves to cost when the risk difference is inside the noise", () => {
    // Identical mechanically, one cheaper. Ranking on a one-point risk
    // difference would be inventing precision the estimate does not have.
    const dear = candidate("Drahší", { price: 1000 });
    const cheap = candidate("Lacnejší", { price: 700 });

    const result = compareCandidates([dear, cheap], NOW);

    expect(result.basis).toBe("cost");
    expect(result.winner?.evidence.product.model).toBe("Lacnejší");
    expect(result.reasons.join(" ")).toContain("rozhoduje cena");
  });

  it("declares no winner when nothing separates them", () => {
    const result = compareCandidates([candidate("A"), candidate("B")], NOW);

    expect(result.basis).toBe("tie");
    expect(result.winner).toBeNull();
    // Silence would read as a failure; this states the finding.
    expect(result.reasons.join(" ")).toContain("rovnako");
  });

  it("gives tied candidates the same rank rather than an arbitrary order", () => {
    const result = compareCandidates([candidate("A"), candidate("B")], NOW);
    expect(result.candidates.map((c) => c.rank)).toEqual([1, 1]);
  });

  it("ranks three candidates and still names one", () => {
    const best = candidate("Najlepší", { probability: 8, repairCost: [60, 100] });
    const middle = candidate("Stredný", { probability: 35, repairCost: [200, 260] });
    const worst = candidate("Najhorší", { probability: 85, repairCost: [400, 500] });

    const result = compareCandidates([middle, worst, best], NOW);

    expect(result.candidates.map((c) => c.evidence.product.model)).toEqual([
      "Najlepší",
      "Stredný",
      "Najhorší",
    ]);
    expect(result.winner?.evidence.product.model).toBe("Najlepší");
  });
});

describe("a close field of three", () => {
  it("does not overlook a cheaper candidate sitting in third place", () => {
    // Sorted on risk, the cheapest of an indistinguishable set can land last.
    // Deciding cost between the top two would recommend a product dearer than
    // one no riskier than it.
    const a = candidate("Prvý", { price: 900 });
    const b = candidate("Druhý", { price: 800 });
    const c = candidate("Tretí", { price: 500 });

    const result = compareCandidates([a, b, c], NOW);

    expect(result.basis).toBe("cost");
    expect(result.winner?.evidence.product.model).toBe("Tretí");
    expect(result.candidates[0].evidence.product.model).toBe("Tretí");
  });

  it("ignores a cheap candidate that is genuinely riskier", () => {
    // Cheapness only decides among candidates the risk could not separate.
    const safe = candidate("Bezpečný", { price: 900, probability: 10, repairCost: [80, 120] });
    const cheapRisky = candidate("Lacný", { price: 300, probability: 85, repairCost: [400, 500] });

    const result = compareCandidates([safe, cheapRisky], NOW);

    expect(result.winner?.evidence.product.model).toBe("Bezpečný");
    expect(result.basis).not.toBe("cost");
  });

  it("keeps every drawn candidate at the same rank after reordering", () => {
    const result = compareCandidates(
      [candidate("A", { price: 900 }), candidate("B", { price: 800 }), candidate("C", { price: 500 })],
      NOW,
    );

    expect(result.candidates.map((c) => c.rank)).toEqual([1, 1, 1]);
  });
});

describe("candidates that are not alternatives", () => {
  it("declines to pick between different categories", () => {
    // Nobody chooses between a washing machine and a television. Naming a
    // winner would answer a question the buyer is not asking, confidently.
    const washer = candidate("Práčka");
    const tv = candidate("Televízor", { price: 900 });
    tv.evidence.product.category = "Televízor";

    const result = compareCandidates([washer, tv], NOW);

    expect(result.basis).toBe("incomparable");
    expect(result.winner).toBeNull();
    expect(result.reasons.join(" ")).toContain("nie sú vzájomné alternatívy");
  });

  it("still shows both assessments rather than refusing outright", () => {
    const washer = candidate("Práčka");
    const tv = candidate("Televízor");
    tv.evidence.product.category = "Televízor";

    const result = compareCandidates([washer, tv], NOW);

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((c) => c.score.verdict)).toBe(true);
  });

  it("treats a category written differently as the same category", () => {
    const a = candidate("A");
    const b = candidate("B", { price: 700 });
    b.evidence.product.category = "  práčka ";

    expect(compareCandidates([a, b], NOW).basis).not.toBe("incomparable");
  });
});

describe("what the comparison tells the reader", () => {
  it("counts the buyer's own price when they gave one", () => {
    // The same machine on offer cheaper should win on total cost.
    const listed = { ...candidate("A", { price: 1000 }) };
    const discounted = { ...candidate("B", { price: 1000 }), offeredPrice: 600 };

    const result = compareCandidates([listed, discounted], NOW);

    expect(result.basis).toBe("cost");
    expect(result.winner?.evidence.product.model).toBe("B");
  });

  it("flags when one assessment rests on much thinner evidence", () => {
    const known = candidate("Známy");
    const obscure = candidate("Neznámy");
    obscure.evidence.product.matchLevel = "category";

    const reasons = compareCandidates([known, obscure], NOW).reasons.join(" ");

    expect(reasons).toContain("servisných podkladov");
  });

  it("never lets thin evidence alone decide the winner", () => {
    // Confidence describes what an estimate stands on. Ranking by it would
    // punish an obscure product for being obscure rather than for being bad.
    const obscure = candidate("Neznámy", { probability: 8, repairCost: [50, 80] });
    obscure.evidence.product.matchLevel = "category";
    const known = candidate("Známy", { probability: 70, repairCost: [300, 400] });

    expect(compareCandidates([known, obscure], NOW).winner?.evidence.product.model).toBe("Neznámy");
  });

  it("always explains itself", () => {
    for (const pair of [
      [candidate("A"), candidate("B", { price: 500 })],
      [candidate("A"), candidate("B", { probability: 90, repairCost: [400, 500] })],
      [candidate("A"), candidate("B")],
    ]) {
      const result = compareCandidates(pair, NOW);
      expect(result.reasons.length, result.basis).toBeGreaterThan(0);
      expect(result.reasons.every((r) => r.trim().length > 0)).toBe(true);
    }
  });

  it("handles a single candidate without pretending to compare", () => {
    const result = compareCandidates([candidate("Sám")], NOW);

    expect(result.winner?.evidence.product.model).toBe("Sám");
    expect(result.reasons).toEqual([]);
  });

  it("handles an empty field without throwing", () => {
    expect(compareCandidates([], NOW).winner).toBeNull();
  });
});
