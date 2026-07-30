/**
 * Coerces the model's JSON into a trustworthy `AnalysisEvidence`.
 *
 * The model is instructed, not trusted: anything malformed is repaired or
 * dropped here. Sources without a real URL are discarded rather than shown,
 * and a failure that loses all of its sources is downgraded to an estimate
 * instead of silently keeping a citation it can no longer support.
 */

import {
  DEFAULT_SERVICE_LIFE_YEARS,
  MAX_SERVICE_LIFE_YEARS,
  MIN_SERVICE_LIFE_YEARS,
} from "./analysis";
import type {
  AnalysisEvidence,
  Basis,
  Competitor,
  Difficulty,
  Failure,
  MatchLevel,
  ProductIdentity,
  Rating,
  RiskLevel,
  Source,
  SourceAuthority,
} from "./analysis";

const MAX_FAILURES = 8;
const MAX_LIST_ITEMS = 6;
const MAX_SOURCES = 20;
const MAX_TEXT = 900;
const MAX_SHORT_TEXT = 220;

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** Strips control characters so model output can never break the rendered page. */
function stripControl(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f ? " " : ch;
  }
  return out;
}

function text(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== "string") return "";
  return stripControl(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function stringList(value: unknown, max = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => text(v, MAX_SHORT_TEXT))
    .filter((v) => v.length > 0)
    .slice(0, max);
}

/** Money range, ordered low→high, with negatives and absurd values rejected. */
function costRange(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lo = num(value[0]);
  const hi = num(value[1]);
  if (lo === null || hi === null) return null;
  const low = clamp(Math.min(lo, hi), 0, 100_000);
  const high = clamp(Math.max(lo, hi), 0, 100_000);
  return high === 0 ? null : [Math.round(low), Math.round(high)];
}

/** Ownership-year window, ordered and bounded to a plausible service life. */
function onsetWindow(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const from = num(value[0]);
  const to = num(value[1]);
  if (from === null || to === null) return null;
  return [
    Math.round(clamp(Math.min(from, to), 0, 30) * 10) / 10,
    Math.round(clamp(Math.max(from, to), 0, 30) * 10) / 10,
  ];
}

function isoDate(value: unknown): string | null {
  const raw = text(value, 10);
  return /^\d{4}-\d{2}(-\d{2})?$/.test(raw) ? raw : null;
}

function httpUrl(value: unknown): string | null {
  const raw = text(value, 500);
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const AUTHORITIES: readonly SourceAuthority[] = [
  "authorized_service",
  "service_manual",
  "repair_shop",
  "forum",
  "community",
];
const BASES: readonly Basis[] = ["fact", "estimate", "assumption"];
const RATINGS: readonly Rating[] = ["good", "fair", "poor"];
const DIFFICULTIES: readonly Difficulty[] = ["low", "medium", "high"];
const RISK_LEVELS: readonly RiskLevel[] = ["high", "medium", "low"];
const MATCH_LEVELS: readonly MatchLevel[] = ["exact", "family", "category"];
const STANDINGS = ["better", "similar", "worse"] as const;

function normalizeSources(value: unknown): Source[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const sources: Source[] = [];

  for (const raw of value) {
    if (!isObject(raw)) continue;
    const url = httpUrl(raw.url);
    const name = text(raw.name, MAX_SHORT_TEXT);
    // A citation the reader cannot open is not a citation.
    if (!url || !name || seen.has(url)) continue;
    seen.add(url);
    sources.push({
      id: text(raw.id, 40) || `s${sources.length + 1}`,
      name,
      url,
      authority: oneOf(raw.authority, AUTHORITIES, "community"),
      date: isoDate(raw.date),
    });
    if (sources.length >= MAX_SOURCES) break;
  }
  return sources;
}

function normalizeFailures(value: unknown, sourceIds: Set<string>): Failure[] {
  if (!Array.isArray(value)) return [];
  const failures: Failure[] = [];

  for (const raw of value) {
    if (!isObject(raw)) continue;
    const component = text(raw.component, MAX_SHORT_TEXT);
    const repairCost = costRange(raw.repairCost);
    if (!component || !repairCost) continue;

    const cited = stringList(raw.sourceIds, 8).filter((id) => sourceIds.has(id));
    const claimedBasis = oneOf(raw.basis, BASES, "estimate");
    // Without a surviving citation, a "fact" is at best a reasoned estimate.
    const basis: Basis = cited.length === 0 && claimedBasis === "fact" ? "estimate" : claimedBasis;

    failures.push({
      component,
      description: text(raw.description, MAX_TEXT),
      riskLevel: oneOf(raw.riskLevel, RISK_LEVELS, "medium"),
      probability: Math.round(clamp(num(raw.probability) ?? 10, 1, 95)),
      frequency: text(raw.frequency, MAX_SHORT_TEXT),
      onsetYears: onsetWindow(raw.onsetYears),
      repairCost,
      basis,
      difficulty: oneOf(raw.difficulty, DIFFICULTIES, "medium"),
      sourceIds: cited,
    });
    if (failures.length >= MAX_FAILURES) break;
  }

  return failures.sort(
    (a, b) =>
      (b.probability / 100) * (b.repairCost[0] + b.repairCost[1]) -
      (a.probability / 100) * (a.repairCost[0] + a.repairCost[1]),
  );
}

function normalizeCompetitors(value: unknown): Competitor[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((raw) => ({
      name: text(raw.name, MAX_SHORT_TEXT),
      standing: oneOf(raw.standing, STANDINGS, "similar"),
      note: text(raw.note, MAX_SHORT_TEXT),
    }))
    .filter((c) => c.name.length > 0)
    .slice(0, 4);
}

function normalizeProduct(value: unknown, fallbackName: string): ProductIdentity | null {
  const raw = isObject(value) ? value : {};
  const brand = text(raw.brand, 60);
  const model = text(raw.model, 80) || fallbackName;
  if (!model) return null;

  const year = num(raw.releaseYear);
  const price = num(raw.estimatedPrice);

  return {
    brand,
    model,
    category: text(raw.category, 60) || "Výrobok",
    releaseYear: year !== null && year >= 1980 && year <= 2100 ? Math.round(year) : null,
    specs: stringList(raw.specs, MAX_LIST_ITEMS),
    matchLevel: oneOf(raw.matchLevel, MATCH_LEVELS, "category"),
    estimatedPrice: price !== null && price > 0 ? Math.round(clamp(price, 1, 1_000_000)) : 0,
    priceBasis: oneOf(raw.priceBasis, BASES, "estimate"),
    // Provisional: resolved against the failures once those are known, because
    // a life shorter than the faults it is supposed to contain is not a life.
    serviceLifeYears: serviceLife(raw.serviceLifeYears),
  };
}

/** A stated service life, or 0 when the model gave nothing usable. */
function serviceLife(value: unknown): number {
  const years = num(value);
  if (years === null || years <= 0) return 0;
  return Math.round(clamp(years, MIN_SERVICE_LIFE_YEARS, MAX_SERVICE_LIFE_YEARS));
}

/**
 * @param fallbackName Model name to fall back on, taken from the user's query.
 * @returns `null` when the payload is too broken to describe any product.
 */
export function normalizeEvidence(input: unknown, fallbackName: string): AnalysisEvidence | null {
  if (!isObject(input)) return null;

  const product = normalizeProduct(input.product, fallbackName);
  if (!product) return null;

  const sources = normalizeSources(input.sources);
  const failures = normalizeFailures(input.failures, new Set(sources.map((s) => s.id)));
  if (failures.length === 0) return null;

  const referenced = new Set(failures.flatMap((f) => f.sourceIds));
  const worstFailure = [...failures].sort((a, b) => b.repairCost[1] - a.repairCost[1])[0];
  const rawWorst = isObject(input.worstCase) ? input.worstCase : {};

  // Fall back to the priciest known failure so the worst case is always real.
  const worstCost = costRange(rawWorst.cost) ?? worstFailure.repairCost;
  const worstComponent = text(rawWorst.component, MAX_SHORT_TEXT) || worstFailure.component;

  // A service life that ends before the faults it is meant to span would make
  // the warranty maths nonsense — every late failure would fall outside every
  // window. Take the product at its word only when the word is consistent.
  const latestOnset = Math.max(0, ...failures.map((f) => f.onsetYears?.[1] ?? 0));
  if (product.serviceLifeYears === 0) {
    product.serviceLifeYears = Math.round(
      clamp(
        Math.max(latestOnset, DEFAULT_SERVICE_LIFE_YEARS),
        MIN_SERVICE_LIFE_YEARS,
        MAX_SERVICE_LIFE_YEARS,
      ),
    );
  } else if (latestOnset > product.serviceLifeYears) {
    product.serviceLifeYears = Math.round(clamp(latestOnset, MIN_SERVICE_LIFE_YEARS, MAX_SERVICE_LIFE_YEARS));
  }

  if (product.estimatedPrice === 0) {
    // Without a price the risk denominator is meaningless; anchor it to the
    // worst repair, which keeps the burden ratio conservative rather than zero.
    product.estimatedPrice = Math.max(50, worstCost[1] * 3);
    product.priceBasis = "assumption";
  }

  const parts = isObject(input.partsAvailability) ? input.partsAvailability : {};
  const difficulty = isObject(input.repairDifficulty) ? input.repairDifficulty : {};

  return {
    product,
    evidenceNote: text(input.evidenceNote),
    failures,
    worstCase: {
      component: worstComponent,
      cost: worstCost,
      note: text(rawWorst.note, MAX_TEXT),
    },
    partsAvailability: {
      rating: oneOf(parts.rating, RATINGS, "fair"),
      note: text(parts.note, MAX_TEXT),
    },
    repairDifficulty: {
      rating: oneOf(difficulty.rating, DIFFICULTIES, "medium"),
      note: text(difficulty.note, MAX_TEXT),
    },
    strengths: stringList(input.strengths),
    weaknesses: stringList(input.weaknesses),
    serviceExperience: text(input.serviceExperience),
    ownerExperience: text(input.ownerExperience),
    competitors: normalizeCompetitors(input.competitors),
    goodFor: stringList(input.goodFor),
    notGoodFor: stringList(input.notGoodFor),
    summary: text(input.summary),
    // Drop sources nothing cites, so the list matches what the analysis used.
    sources: sources.filter((s) => referenced.has(s.id)),
  };
}
