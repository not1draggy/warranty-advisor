/**
 * Property sweep over the normaliser.
 *
 * This is the boundary where untrusted model output becomes something the
 * report renders and the scorer does arithmetic on. Example-based tests check
 * the malformations I thought of; this throws thousands of shapes at it and
 * asserts the invariants everything downstream relies on.
 *
 * The generator is seeded, so a failure here is reproducible rather than a
 * flake that vanishes on re-run.
 */

import { describe, expect, it } from "vitest";
import { normalizeEvidence } from "./normalize";

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

/** Control characters, named so the source stays readable. */
const NUL = String.fromCharCode(0);
const UNIT_SEPARATOR = String.fromCharCode(31);

const CHAOS: unknown[] = [
  undefined,
  null,
  0,
  -1,
  NaN,
  Infinity,
  -Infinity,
  1e12,
  "",
  "   ",
  "text",
  "-5",
  "12,5",
  true,
  false,
  [],
  {},
  [1],
  [3, 1],
  [-9, 1e9],
  ["a", "b"],
  [null, null],
  { nested: { deep: true } },
  "x".repeat(5000),
  // Control characters and a script tag: both must be neutralised, not rendered.
  `line${NUL}break${UNIT_SEPARATOR}here`,
  "<script>alert(1)</script>",
  "javascript:alert(1)",
  "https://ok.example/path",
  "//protocol-relative",
];

const FIELDS = [
  "isProduct",
  "product",
  "evidenceNote",
  "failures",
  "worstCase",
  "partsAvailability",
  "repairDifficulty",
  "strengths",
  "weaknesses",
  "serviceExperience",
  "ownerExperience",
  "competitors",
  "goodFor",
  "notGoodFor",
  "summary",
  "sources",
];

const FAILURE_FIELDS = [
  "component",
  "description",
  "riskLevel",
  "probability",
  "frequency",
  "onsetYears",
  "repairCost",
  "basis",
  "difficulty",
  "sourceIds",
];

const SOURCE_FIELDS = ["id", "name", "url", "authority", "date"];

function wellFormed() {
  return {
    isProduct: true,
    product: {
      brand: "Bosch",
      model: "WAN28160BY",
      category: "Práčka",
      releaseYear: 2020,
      specs: ["7 kg"],
      matchLevel: "exact",
      estimatedPrice: 430,
      priceBasis: "estimate",
    },
    evidenceNote: "Poznámka",
    failures: [
      {
        component: "Ložiská",
        description: "Hluk",
        riskLevel: "high",
        probability: 26,
        frequency: "Po rokoch",
        onsetYears: [7, 10],
        repairCost: [180, 250],
        basis: "fact",
        difficulty: "high",
        sourceIds: ["s1"],
      },
    ],
    worstCase: { component: "Ložiská", cost: [180, 250], note: "" },
    partsAvailability: { rating: "good", note: "Dostupné" },
    repairDifficulty: { rating: "medium", note: "Stredné" },
    strengths: ["Tichý"],
    weaknesses: ["Malá"],
    serviceExperience: "Dobrá",
    ownerExperience: "Dobrá",
    competitors: [{ name: "Beko", standing: "worse", note: "Kratšia" }],
    goodFor: ["Páry"],
    notGoodFor: ["Rodiny"],
    summary: "Dobrá voľba",
    sources: [
      {
        id: "s1",
        name: "Cenník",
        url: "https://example.com/a",
        authority: "repair_shop",
        date: "2026-02-01",
      },
    ],
  } as Record<string, unknown>;
}

/** Replaces one field of the first entry, if that entry is still an object. */
function corrupt(
  list: unknown,
  fields: string[],
  random: () => number,
  chaos: () => unknown,
): void {
  if (!Array.isArray(list)) return;
  const first = list[0];
  if (typeof first !== "object" || first === null) return;
  (first as Record<string, unknown>)[fields[Math.floor(random() * fields.length)]] = chaos();
}

/** Corrupts a well-formed payload in a few random places. */
function mutate(random: () => number): unknown {
  const payload = wellFormed();
  const chaos = () => CHAOS[Math.floor(random() * CHAOS.length)];
  const rounds = 1 + Math.floor(random() * 4);

  for (let i = 0; i < rounds; i += 1) {
    const roll = random();

    if (roll < 0.55) {
      payload[FIELDS[Math.floor(random() * FIELDS.length)]] = chaos();
    } else if (roll < 0.8) {
      // An earlier round may already have replaced the array with junk.
      corrupt(payload.failures, FAILURE_FIELDS, random, chaos);
    } else {
      corrupt(payload.sources, SOURCE_FIELDS, random, chaos);
    }
  }
  return payload;
}

const ITERATIONS = 3_000;

describe("normalizeEvidence under a sweep of malformed payloads", () => {
  it("never throws, whatever shape arrives", () => {
    const random = rng(20260730);

    for (let i = 0; i < ITERATIONS; i += 1) {
      const payload = mutate(random);
      expect(() => normalizeEvidence(payload, "Bosch WAN28160BY"), `iteration ${i}`).not.toThrow();
    }
  });

  it("holds every invariant the report and the scorer depend on", () => {
    const random = rng(19700101);
    let accepted = 0;

    for (let i = 0; i < ITERATIONS; i += 1) {
      const evidence = normalizeEvidence(mutate(random), "Bosch WAN28160BY");
      if (!evidence) continue;
      accepted += 1;

      const where = `iteration ${i}`;
      const { product, failures, sources, worstCase } = evidence;

      // A price of zero would divide the risk burden to nothing.
      expect(product.estimatedPrice, where).toBeGreaterThan(0);
      expect(Number.isFinite(product.estimatedPrice), where).toBe(true);
      expect(product.model.length, where).toBeGreaterThan(0);

      // Rendering an empty analysis is the outcome the product must never reach.
      expect(failures.length, where).toBeGreaterThan(0);

      const sourceIds = new Set(sources.map((s) => s.id));
      for (const source of sources) {
        expect(source.url, where).toMatch(/^https?:\/\//);
        expect(source.name.length, where).toBeGreaterThan(0);
      }

      for (const failure of failures) {
        expect(failure.probability, where).toBeGreaterThanOrEqual(1);
        expect(failure.probability, where).toBeLessThanOrEqual(95);
        expect(Number.isInteger(failure.probability), where).toBe(true);

        const [low, high] = failure.repairCost;
        expect(low, where).toBeGreaterThanOrEqual(0);
        expect(high, where).toBeGreaterThanOrEqual(low);
        expect(Number.isFinite(high), where).toBe(true);

        if (failure.onsetYears) {
          const [from, to] = failure.onsetYears;
          expect(from, where).toBeGreaterThanOrEqual(0);
          expect(to, where).toBeGreaterThanOrEqual(from);
          expect(to, where).toBeLessThanOrEqual(30);
        }

        // A citation pointing at nothing must not survive, and a claim that
        // lost its citations must not still call itself a fact.
        for (const id of failure.sourceIds) expect(sourceIds.has(id), where).toBe(true);
        if (failure.sourceIds.length === 0) expect(failure.basis, where).not.toBe("fact");

        // Control characters would break the rendered page.
        const hasControlChar = [...failure.component].some(
          (ch) => (ch.codePointAt(0) ?? 0) < 0x20 || ch.codePointAt(0) === 0x7f,
        );
        expect(hasControlChar, where).toBe(false);
      }

      const [worstLow, worstHigh] = worstCase.cost;
      expect(worstHigh, where).toBeGreaterThanOrEqual(worstLow);
      expect(worstCase.component.length, where).toBeGreaterThan(0);
    }

    // A sweep that rejected everything would prove nothing about the invariants.
    expect(accepted).toBeGreaterThan(ITERATIONS * 0.5);
  });
});
