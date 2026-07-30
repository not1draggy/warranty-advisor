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
  /**
   * Chance this failure happens at least once over the product's service
   * life, in percent. `onsetYears` says when within that life — the two
   * together are what make a warranty term assessable.
   */
  probability: number;
  /** How often it happens, in plain Slovak. */
  frequency: string;
  /**
   * Ownership years in which the failure typically first appears, e.g. `[7, 10]`
   * for drum bearings. Decides whether a warranty term actually covers it.
   * `null` when the failure has no characteristic onset (accidental damage).
   */
  onsetYears: [number, number] | null;
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
  /**
   * Years this class of product is normally expected to last.
   *
   * Every probability is quoted over this span, so it is what makes an
   * expected repair figure mean anything: 90 € across four years of a phone
   * and across twelve years of a washing machine are different claims.
   */
  serviceLifeYears: number;
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

/**
 * Service life assumed when the research does not establish one.
 *
 * Deliberately mid-range for a major appliance: short enough not to inflate
 * what a warranty appears to cover, long enough not to compress a product's
 * whole failure history into a few years.
 */
export const DEFAULT_SERVICE_LIFE_YEARS = 10;

/** Bounds outside which a stated service life is not credible. */
export const MIN_SERVICE_LIFE_YEARS = 2;
export const MAX_SERVICE_LIFE_YEARS = 25;
