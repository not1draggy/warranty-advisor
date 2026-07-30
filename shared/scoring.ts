/**
 * Deterministic scoring. Everything the user is told about risk, confidence and
 * the verdict is computed here from the evidence — never taken from the model.
 */

import {
  HORIZON_YEARS,
  type AnalysisEvidence,
  type Difficulty,
  type Failure,
  type MatchLevel,
  type Rating,
  type SourceAuthority,
} from "./analysis";

export type VerdictKind = "buy" | "caution" | "avoid";
export type WarrantyWorth = "yes" | "borderline" | "no";

export interface WarrantyAssessment {
  years: number;
  price: number;
  /** Expected repair spend over the warranty term, in EUR. */
  expectedCost: number;
  worth: WarrantyWorth;
}

export interface Score {
  ownershipRisk: number;
  confidence: number;
  verdict: VerdictKind;
  /** Plain-Slovak justification lines — the "why this rating" section. */
  reasons: string[];
  /** Expected repair spend across the whole ownership horizon, in EUR. */
  expectedRepairCost: number;
  /** Cost range of the failures that actually drive the score. */
  typicalRepairCost: [number, number];
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const mid = ([lo, hi]: [number, number]) => (lo + hi) / 2;

/** Cheapest plausible product, so a missing price can never divide risk to zero. */
const MIN_PRICE_EUR = 50;

const PARTS_PENALTY: Record<Rating, number> = { good: 0, fair: 6, poor: 14 };
const DIFFICULTY_PENALTY: Record<Difficulty, number> = { low: 0, medium: 5, high: 11 };
const MATCH_BASE: Record<MatchLevel, number> = { exact: 40, family: 28, category: 18 };
const AUTHORITY_WEIGHT: Record<SourceAuthority, number> = {
  authorized_service: 12,
  service_manual: 11,
  repair_shop: 9,
  forum: 4,
  community: 3,
};

/** Risk stays a verdict about the product, so confidence is capped below certainty. */
const CONFIDENCE_FLOOR = 15;
const CONFIDENCE_CEILING = 92;
/** Below this, evidence is too thin to hand out an unreserved recommendation. */
const CONFIDENCE_FOR_UNRESERVED_BUY = 45;

const BUY_MAX_RISK = 34;
const CAUTION_MAX_RISK = 62;

/** Expected repair spend over the full ownership horizon, in EUR. */
export function expectedRepairCost(failures: Failure[]): number {
  return failures.reduce((sum, f) => sum + (f.probability / 100) * mid(f.repairCost), 0);
}

/** Cost span of the failures likely enough to shape a buying decision. */
export function typicalRepairCost(failures: Failure[]): [number, number] {
  if (failures.length === 0) return [0, 0];
  const likely = failures.filter((f) => f.probability >= 10);
  const basis = likely.length > 0 ? likely : failures;
  return [
    Math.round(Math.min(...basis.map((f) => f.repairCost[0]))),
    Math.round(Math.max(...basis.map((f) => f.repairCost[1]))),
  ];
}

export function ownershipRisk(evidence: AnalysisEvidence): number {
  const price = Math.max(MIN_PRICE_EUR, evidence.product.estimatedPrice);
  const burden = expectedRepairCost(evidence.failures) / price;

  // Calibration: spending ~15% of the purchase price on repairs across five
  // years is ordinary ownership, ~30% is genuinely poor, and 50% saturates the
  // evidence-driven part of the score. The remaining 30 points come from
  // serviceability penalties.
  let risk = clamp(burden * 140, 0, 70);
  risk += PARTS_PENALTY[evidence.partsAvailability.rating];
  risk += DIFFICULTY_PENALTY[evidence.repairDifficulty.rating];

  const worstShare = evidence.worstCase.cost[1] / price;
  if (worstShare >= 0.7) risk += 14;
  else if (worstShare >= 0.45) risk += 8;

  return Math.round(clamp(risk, 0, 100));
}

function isRecent(date: string | null, now: Date, months: number): boolean {
  if (!date) return false;
  const parsed = new Date(date.length === 7 ? `${date}-01` : date);
  if (Number.isNaN(parsed.getTime())) return false;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return parsed >= cutoff;
}

export function confidence(evidence: AnalysisEvidence, now: Date = new Date()): number {
  let score = MATCH_BASE[evidence.product.matchLevel];

  const sourceScore = evidence.sources.reduce((sum, s) => sum + AUTHORITY_WEIGHT[s.authority], 0);
  score += Math.min(45, sourceScore);

  if (evidence.sources.some((s) => isRecent(s.date, now, 24))) score += 5;

  // Resolve citations against the real source list: an id pointing at nothing
  // must not earn the coverage bonus.
  const known = new Set(evidence.sources.map((s) => s.id));
  const cited = evidence.failures.filter((f) => f.sourceIds.some((id) => known.has(id))).length;
  if (evidence.failures.length > 0 && cited / evidence.failures.length >= 0.6) score += 5;

  return Math.round(clamp(score, CONFIDENCE_FLOOR, CONFIDENCE_CEILING));
}

export function verdictFor(ownershipRisk: number, confidence: number): VerdictKind {
  const byRisk: VerdictKind =
    ownershipRisk <= BUY_MAX_RISK ? "buy" : ownershipRisk <= CAUTION_MAX_RISK ? "caution" : "avoid";

  // Thin evidence never blocks a recommendation, it only makes it more careful.
  return byRisk === "buy" && confidence < CONFIDENCE_FOR_UNRESERVED_BUY ? "caution" : byRisk;
}

const eur = (n: number) => `${Math.round(n).toLocaleString("sk-SK")} €`;

function buildReasons(evidence: AnalysisEvidence, score: Omit<Score, "reasons">): string[] {
  const reasons: string[] = [];
  const { failures, product } = evidence;

  const dominant = [...failures].sort(
    (a, b) => (b.probability / 100) * mid(b.repairCost) - (a.probability / 100) * mid(a.repairCost),
  )[0];

  if (dominant) {
    reasons.push(
      `Na hodnotenie má najväčší vplyv ${dominant.component.toLowerCase()} — ` +
        `porucha s odhadovanou pravdepodobnosťou ${dominant.probability} % počas ${HORIZON_YEARS} rokov ` +
        `a cenou opravy ${eur(dominant.repairCost[0])} až ${eur(dominant.repairCost[1])}.`,
    );
  }

  const share = Math.round((score.expectedRepairCost / Math.max(MIN_PRICE_EUR, product.estimatedPrice)) * 100);
  reasons.push(
    `Očakávané náklady na opravy počas ${HORIZON_YEARS} rokov sú približne ${eur(score.expectedRepairCost)}, ` +
      `čo zodpovedá zhruba ${share} % ceny výrobku.`,
  );

  const partsReason: Record<Rating, string> = {
    good: "Náhradné diely sú bežne dostupné, čo znižuje riziko aj cenu prípadnej opravy.",
    fair: "Dostupnosť náhradných dielov je obmedzenejšia, oprava môže trvať dlhšie.",
    poor: "Náhradné diely sa zháňajú ťažko, čo predražuje a predlžuje každú opravu.",
  };
  reasons.push(partsReason[evidence.partsAvailability.rating]);

  const difficultyReason: Record<Difficulty, string> = {
    low: "Väčšinu zásahov zvládne bežný servis rýchlo a lacno.",
    medium: "Opravy si vyžadujú skúsenejší servis, práca tvorí podstatnú časť ceny.",
    high: "Konštrukcia sťažuje opravy, práca často stojí viac než samotný diel.",
  };
  reasons.push(difficultyReason[evidence.repairDifficulty.rating]);

  const matchReason: Record<MatchLevel, string> = {
    exact: "Podklady sa týkajú priamo tohto modelu.",
    family:
      "Priamo k tomuto modelu je verejných servisných údajov málo, preto hodnotenie vychádza aj z modelov rovnakej rady s takmer zhodnou konštrukciou.",
    category:
      "K tomuto konkrétnemu modelu sa verejné servisné údaje takmer nevyskytujú, preto hodnotenie stavia na porovnateľných výrobkoch, typických slabinách kategórie a skúsenostiach servisov.",
  };
  reasons.push(matchReason[product.matchLevel]);

  return reasons;
}

export function scoreAnalysis(evidence: AnalysisEvidence, now: Date = new Date()): Score {
  const risk = ownershipRisk(evidence);
  const conf = confidence(evidence, now);
  const base = {
    ownershipRisk: risk,
    confidence: conf,
    verdict: verdictFor(risk, conf),
    expectedRepairCost: Math.round(expectedRepairCost(evidence.failures)),
    typicalRepairCost: typicalRepairCost(evidence.failures),
  };
  return { ...base, reasons: buildReasons(evidence, base) };
}

/**
 * Is a paid extended warranty worth it for this product?
 * Compares its price against the repair spend expected over the same term.
 */
export function assessWarranty(
  evidence: AnalysisEvidence,
  years: number,
  price: number,
): WarrantyAssessment {
  const expected = expectedRepairCost(evidence.failures) * (years / HORIZON_YEARS);

  let worth: WarrantyWorth;
  if (price <= 0) worth = "yes";
  else if (expected >= price * 1.3) worth = "yes";
  else if (expected <= price * 0.7) worth = "no";
  else worth = "borderline";

  return { years, price, expectedCost: Math.round(expected), worth };
}
