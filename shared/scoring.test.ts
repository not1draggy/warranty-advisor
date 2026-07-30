import { describe, expect, it } from "vitest";
import type { AnalysisEvidence, Failure, Source } from "./analysis";
import {
  assessWarranty,
  confidence,
  expectedRepairCost,
  ownershipRisk,
  scoreAnalysis,
  typicalRepairCost,
  verdictFor,
} from "./scoring";

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
    basis: "estimate",
    difficulty: "medium",
    sourceIds: [],
    ...overrides,
  };
}

function source(overrides: Partial<Source> = {}): Source {
  return {
    id: "s1",
    name: "Zdroj",
    url: "https://example.com/a",
    authority: "repair_shop",
    date: "2026-01-15",
    ...overrides,
  };
}

function evidence(overrides: Partial<AnalysisEvidence> = {}): AnalysisEvidence {
  return {
    product: {
      brand: "Značka",
      model: "M1",
      category: "Spotrebič",
      releaseYear: 2022,
      specs: [],
      matchLevel: "exact",
      estimatedPrice: 1000,
      priceBasis: "estimate",
    },
    evidenceNote: "",
    failures: [
      failure({ component: "A", probability: 40, repairCost: [250, 350], sourceIds: ["s1"] }),
      failure({ component: "B", probability: 20, repairCost: [100, 200], sourceIds: ["s2"] }),
      failure({ component: "C", probability: 5, repairCost: [50, 90] }),
    ],
    worstCase: { component: "A", cost: [250, 350], note: "" },
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
    sources: [
      source({ id: "s1", authority: "authorized_service" }),
      source({ id: "s2", authority: "repair_shop", url: "https://example.com/b" }),
    ],
    ...overrides,
  };
}

describe("expectedRepairCost", () => {
  it("weights each repair by its probability", () => {
    // 0.4*300 + 0.2*150 + 0.05*70
    expect(expectedRepairCost(evidence().failures)).toBeCloseTo(153.5, 5);
  });

  it("is zero when there is nothing to repair", () => {
    expect(expectedRepairCost([])).toBe(0);
  });
});

describe("typicalRepairCost", () => {
  it("spans only the failures likely enough to shape a decision", () => {
    // The 5% failure is excluded, so the range starts at B's lower bound.
    expect(typicalRepairCost(evidence().failures)).toEqual([100, 350]);
  });

  it("falls back to every failure when none reaches the likelihood floor", () => {
    const unlikely = [failure({ probability: 3, repairCost: [40, 60] })];
    expect(typicalRepairCost(unlikely)).toEqual([40, 60]);
  });
});

describe("ownershipRisk", () => {
  it("scales with repair burden relative to the product price", () => {
    expect(ownershipRisk(evidence())).toBe(21);
  });

  it("rises when the same repairs hit a cheaper product", () => {
    const cheap = evidence();
    cheap.product.estimatedPrice = 400;
    expect(ownershipRisk(cheap)).toBeGreaterThan(ownershipRisk(evidence()));
  });

  it("penalises scarce parts and difficult repairs", () => {
    const awkward = evidence({
      partsAvailability: { rating: "poor", note: "" },
      repairDifficulty: { rating: "high", note: "" },
    });
    expect(ownershipRisk(awkward)).toBe(21 + 14 + 11);
  });

  it("adds a penalty when the worst repair approaches the product price", () => {
    const writeOff = evidence({
      worstCase: { component: "A", cost: [700, 800], note: "" },
    });
    expect(ownershipRisk(writeOff)).toBe(21 + 14);
  });

  it("never leaves the 0-100 range", () => {
    const dire = evidence({
      failures: [failure({ probability: 95, repairCost: [900, 1000] })],
      partsAvailability: { rating: "poor", note: "" },
      repairDifficulty: { rating: "high", note: "" },
      worstCase: { component: "A", cost: [900, 1000], note: "" },
    });
    expect(ownershipRisk(dire)).toBeLessThanOrEqual(100);
    expect(ownershipRisk(evidence({ failures: [failure({ probability: 1, repairCost: [1, 2] })] })))
      .toBeGreaterThanOrEqual(0);
  });

  it("treats a missing price conservatively rather than as zero risk", () => {
    const priceless = evidence();
    priceless.product.estimatedPrice = 0;
    expect(ownershipRisk(priceless)).toBeGreaterThan(0);
  });
});

describe("confidence", () => {
  it("combines model match, source authority, freshness and coverage", () => {
    // 40 exact + 21 authority + 5 freshness + 5 coverage
    expect(confidence(evidence(), NOW)).toBe(71);
  });

  it("drops when the evidence only covers the wider category", () => {
    const thin = evidence({ sources: [] });
    thin.product.matchLevel = "category";
    expect(confidence(thin, NOW)).toBe(18);
  });

  it("never reaches certainty", () => {
    // Four authoritative, recent, fully cited sources would score 95 unclamped.
    const strong = evidence({
      sources: ["s1", "s2", "s3", "s4"].map((id) =>
        source({ id, authority: "authorized_service", url: `https://example.com/${id}` }),
      ),
    });
    expect(confidence(strong, NOW)).toBe(92);
  });

  it("ignores citations that point at a source which is not listed", () => {
    const dangling = evidence({ sources: [] });
    const withGhostCitations = confidence(dangling, NOW);

    dangling.failures = dangling.failures.map((f) => ({ ...f, sourceIds: [] }));
    expect(confidence(dangling, NOW)).toBe(withGhostCitations);
  });

  it("ignores sources that are too old to count as fresh", () => {
    const stale = evidence({
      sources: [source({ id: "s1", authority: "authorized_service", date: "2019-01-01" })],
    });
    expect(confidence(stale, NOW)).toBe(confidence(stale, NOW));
    expect(confidence(stale, NOW)).toBeLessThan(confidence(evidence(), NOW));
  });
});

describe("verdictFor", () => {
  it("maps risk onto the three possible recommendations", () => {
    expect(verdictFor(10, 80)).toBe("buy");
    expect(verdictFor(50, 80)).toBe("caution");
    expect(verdictFor(80, 80)).toBe("avoid");
  });

  it("holds back an unreserved recommendation when evidence is thin", () => {
    expect(verdictFor(10, 30)).toBe("caution");
  });

  it("still returns a verdict at the lowest possible confidence", () => {
    expect(verdictFor(90, 15)).toBe("avoid");
  });
});

describe("scoreAnalysis", () => {
  it("always explains the rating", () => {
    const score = scoreAnalysis(evidence(), NOW);
    expect(score.reasons.length).toBeGreaterThan(0);
    expect(score.reasons.every((reason) => reason.trim().length > 0)).toBe(true);
  });

  it("names the dominant failure first", () => {
    expect(scoreAnalysis(evidence(), NOW).reasons[0]).toContain("a");
  });

  it("says the estimate leans on comparable models when the match is loose", () => {
    const thin = evidence();
    thin.product.matchLevel = "category";
    expect(scoreAnalysis(thin, NOW).reasons.join(" ")).toContain("porovnateľných");
  });

  it("produces a verdict even with no sources at all", () => {
    const bare = evidence({ sources: [] });
    bare.product.matchLevel = "category";
    const score = scoreAnalysis(bare, NOW);
    expect(["buy", "caution", "avoid"]).toContain(score.verdict);
  });
});

describe("assessWarranty coverage window", () => {
  const single = (overrides: Partial<Failure>) =>
    evidence({
      failures: [failure({ probability: 30, repairCost: [200, 300], ...overrides })],
    });

  it("adds cover only after the statutory warranty lapses", () => {
    const assessment = assessWarranty(evidence(), 3, 50);
    expect(assessment.coversFrom).toBe(2);
    expect(assessment.coversTo).toBe(5);
  });

  it("is worthless against a failure that arrives after it expires", () => {
    // Drum bearings at seven years, against three years of cover ending at five.
    const assessment = assessWarranty(single({ onsetYears: [7, 10] }), 3, 60);
    expect(assessment.expectedCost).toBe(0);
    expect(assessment.worth).toBe("no");
  });

  it("gives no credit for failures the statutory warranty already covers", () => {
    expect(assessWarranty(single({ onsetYears: [0, 1] }), 3, 60).expectedCost).toBe(0);
  });

  it("counts the part of an onset window that overlaps the cover", () => {
    // Cover spans years 2-5; two of the failure's three onset years fall inside.
    expect(assessWarranty(single({ onsetYears: [3, 6] }), 3, 40).expectedCost).toBe(50);
  });

  it("names the dominant failure the cover would expire before", () => {
    const assessment = assessWarranty(
      single({ component: "Ložiská bubna", onsetYears: [7, 10] }),
      3,
      60,
    );
    expect(assessment.note).toContain("Ložiská bubna");
    expect(assessment.note).toContain("7. až 10.");
  });

  it("confirms cover that reaches the years the product actually fails in", () => {
    expect(assessWarranty(single({ onsetYears: [3, 6] }), 3, 40).note).toContain(
      "Krytie zasahuje",
    );
  });

  it("spreads a failure with no characteristic timing across the horizon", () => {
    const accidental = single({ onsetYears: null });
    // Cover spans years 2-5, so three fifths of a five-year uniform risk.
    expect(assessWarranty(accidental, 3, 40).expectedCost).toBe(45);
  });
});

describe("assessWarranty", () => {
  it("recommends cover when expected repairs clearly exceed the price", () => {
    expect(assessWarranty(evidence(), 3, 40)).toMatchObject({ worth: "yes", expectedCost: 92 });
  });

  it("calls it borderline when the two are close", () => {
    expect(assessWarranty(evidence(), 2, 50).worth).toBe("borderline");
  });

  it("advises against cover that costs more than the expected repairs", () => {
    expect(assessWarranty(evidence(), 1, 100).worth).toBe("no");
  });

  it("treats free cover as worth taking", () => {
    expect(assessWarranty(evidence(), 1, 0).worth).toBe("yes");
  });

  it("scales the expected cost with the length of the term", () => {
    const short = assessWarranty(evidence(), 1, 50).expectedCost;
    const long = assessWarranty(evidence(), 5, 50).expectedCost;
    expect(long).toBeGreaterThan(short);
  });
});
