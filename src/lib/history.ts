/**
 * Recently analysed products, kept in the browser.
 *
 * The real job is comparing a shortlist before buying, and every revisit is
 * served from the server-side cache instantly — so the only thing missing was
 * a way back to what you already looked at.
 */

import type { VerdictKind } from "../../shared/scoring";
import { normalizeQuery } from "../../shared/text";

export interface HistoryEntry {
  /** The raw query, so warranty terms survive the round trip. */
  query: string;
  model: string;
  verdict: VerdictKind;
  risk: number;
  at: number;
}

const STORAGE_KEY = "wa-history";
const MAX_ENTRIES = 6;

/** Storage is unavailable in private modes and when cookies are blocked. */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<HistoryEntry>;
  return (
    typeof entry.query === "string" &&
    typeof entry.model === "string" &&
    typeof entry.risk === "number" &&
    typeof entry.at === "number" &&
    (entry.verdict === "buy" || entry.verdict === "caution" || entry.verdict === "avoid")
  );
}

export function readHistory(): HistoryEntry[] {
  const store = storage();
  if (!store) return [];

  try {
    const parsed: unknown = JSON.parse(store.getItem(STORAGE_KEY) ?? "[]");
    // Anything written by an older version, or by hand, is simply ignored.
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

/** Adds an analysis, replacing any earlier look at the same product. */
export function recordAnalysis(entry: Omit<HistoryEntry, "at">): HistoryEntry[] {
  const store = storage();
  if (!store) return [];

  const key = normalizeQuery(entry.query);
  const next = [
    { ...entry, at: Date.now() },
    ...readHistory().filter((existing) => normalizeQuery(existing.query) !== key),
  ].slice(0, MAX_ENTRIES);

  try {
    store.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A full or read-only quota must not break the analysis itself.
  }
  return next;
}

export function clearHistory(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — the list is a convenience, not state we depend on.
  }
}
