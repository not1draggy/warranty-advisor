/**
 * Collapses queries that mean the same product onto one key: case, accents,
 * punctuation and spacing differences should not look like different products.
 * Used for the server-side cache key and for demo-catalogue matching.
 */
export function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
