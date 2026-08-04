/**
 * Query parsing.
 *
 * A query is a product name, optionally followed by the price being offered
 * and by extended-warranty terms:
 *
 *   `Bosch WAN28160BY 349€ +3 70,90€`
 *   → "price a 3-year warranty at 70.90 €, for a machine on offer at 349 €"
 *
 * The price is what the buyer is actually being asked to pay, which is rarely
 * the typical market price the research finds. Both are kept: the market price
 * says what the product is worth, the offered price says what this deal costs.
 */

export interface ParsedQuery {
  product: string;
  /** Price the buyer is being offered, in EUR; `null` when not stated. */
  price: number | null;
  warrantyYears: number | null;
  warrantyPrice: number | null;
}

const WARRANTY_PATTERN =
  /(?:^|\s)\+(\d{1,2})\s*(?:r|rok|roky|rokov)?(?:\s+(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur)?)?(?=\s|$)/i;

/**
 * A price must carry a currency marker. Model numbers are full of digits —
 * `UE75NU8000` — so a bare number is never read as one.
 */
const PRICE_PATTERN = /(?:^|\s)(?:za\s+)?(\d{1,6}(?:[ .]\d{3})*(?:[.,]\d{1,2})?)\s*(?:€|eur)(?=\s|$)/i;

const MAX_PRICE_EUR = 100_000;

export function parseQuery(raw: string): ParsedQuery {
  let product = raw.trim();
  let price: number | null = null;
  let warrantyYears: number | null = null;
  let warrantyPrice: number | null = null;

  // Warranty terms come out first: they carry a price of their own, and
  // leaving it in would let it be read as the product's.
  const warranty = product.match(WARRANTY_PATTERN);
  if (warranty) {
    const yearsValue = Number.parseInt(warranty[1], 10);
    if (yearsValue >= 1 && yearsValue <= 10) {
      warrantyYears = yearsValue;
      if (warranty[2]) warrantyPrice = Number.parseFloat(warranty[2].replace(",", "."));
      product = product.replace(warranty[0], " ");
    }
  }

  const offered = product.match(PRICE_PATTERN);
  if (offered) {
    // Thousands may be grouped with a space or a dot; the decimal is a comma
    // or a dot, and only ever the last separator.
    const value = Number.parseFloat(
      offered[1]
        .replace(/[ ]/g, "")
        .replace(/\.(?=\d{3}\b)/g, "")
        .replace(",", "."),
    );
    if (Number.isFinite(value) && value > 0 && value <= MAX_PRICE_EUR) {
      price = value;
      product = product.replace(offered[0], " ");
    }
  }

  return {
    product: product.replace(/\s+/g, " ").trim(),
    price,
    warrantyYears,
    warrantyPrice,
  };
}

/**
 * Separators people use between two candidates they are choosing among.
 *
 * Word-bounded on purpose: a slash or a bare dash appears inside model numbers
 * often enough that treating either as a separator would split one product in
 * half.
 */
const COMPARISON_SPLIT = /\s+(?:vs\.?|versus|alebo|proti)\s+/i;

/** Comparing more than this stops being a decision and starts being a list. */
export const MAX_COMPARISON = 3;

/**
 * Splits a query into the candidates being weighed against each other.
 *
 * Each part keeps its own price and warranty terms, because a buyer comparing
 * two offers is usually comparing two different prices.
 */
export function parseComparison(raw: string): ParsedQuery[] {
  return raw
    .split(COMPARISON_SPLIT)
    .map((part) => parseQuery(part))
    .filter((parsed) => parsed.product.length > 0)
    .slice(0, MAX_COMPARISON);
}

export const EXAMPLE_QUERIES = [
  "Samsung UE75NU8000",
  "iPhone 13",
  "Bosch WAN28160BY 349€ +3 70,90€",
];
