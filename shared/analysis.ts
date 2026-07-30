/**
 * Shared contract between the analysis endpoint and the UI.
 *
 * The model returns EVIDENCE only. Ownership risk, confidence and the final
 * verdict are derived from that evidence by `scoring.ts`, so a recommendation
 * can never be hallucinated and is always reproducible from the inputs.
 */

export type SourceAuthority =
  | "authorized_service"
  | "service_manual"
  | "repair_shop"
  | "forum"
  | "community";

/** How a single claim is grounded: measured fact, reasoned estimate, or expert assumption. */
export type Basis = "fact" | "estimate" | "assumption";

export type Rating = "good" | "fair" | "poor";
export type Difficulty = "low" | "medium" | "high";
export type RiskLevel = "high" | "medium" | "low";

/** How closely the evidence matches what the user actually asked about. */
export type MatchLevel = "exact" | "family" | "category";

export interface Source {
  id: string;
  name: string;
  /** Absolute URL. `null` only for demo data, which is never presented as researched. */
  url: string | null;
  authority: SourceAuthority;
  /** `YYYY-MM-DD` or `YYYY-MM`; `null` when the page carries no date. */
  date: string | null;
}

export interface Failure {
  component: string;
  description: string;
  riskLevel: RiskLevel;
  /** Chance this failure occurs at least once within `HORIZON_YEARS`, in percent. */
  probability: number;
  /** How often it happens, in plain Slovak. */
  frequency: string;
  /** Full repair cost range in EUR, parts + labour included. */
  repairCost: [number, number];
  basis: Basis;
  difficulty: Difficulty;
  sourceIds: string[];
}

export interface Competitor {
  name: string;
  standing: "better" | "similar" | "worse";
  note: string;
}

export interface ProductIdentity {
  brand: string;
  model: string;
  category: string;
  releaseYear: number | null;
  specs: string[];
  matchLevel: MatchLevel;
  /** Typical current market price in EUR — the denominator for ownership risk. */
  estimatedPrice: number;
  priceBasis: Basis;
}

export interface AnalysisEvidence {
  product: ProductIdentity;
  /** What the research actually turned up, and why anything unfound was inferred. */
  evidenceNote: string;
  failures: Failure[];
  worstCase: { component: string; cost: [number, number]; note: string };
  partsAvailability: { rating: Rating; note: string };
  repairDifficulty: { rating: Difficulty; note: string };
  strengths: string[];
  weaknesses: string[];
  serviceExperience: string;
  ownerExperience: string;
  competitors: Competitor[];
  goodFor: string[];
  notGoodFor: string[];
  summary: string;
  sources: Source[];
}

/** Ownership window every probability and cost estimate is measured over. */
export const HORIZON_YEARS = 5;
