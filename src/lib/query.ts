/**
 * Query parsing.
 *
 * A query is a product name, optionally followed by extended-warranty terms:
 * `Bosch WAN28160BY +3 70,90€` means "and price a 3-year warranty at 70.90 €".
 */

export interface ParsedQuery {
  product: string;
  warrantyYears: number | null;
  warrantyPrice: number | null;
}

const WARRANTY_PATTERN =
  /(?:^|\s)\+(\d{1,2})\s*(?:r|rok|roky|rokov)?(?:\s+(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur)?)?(?=\s|$)/i;

export function parseQuery(raw: string): ParsedQuery {
  let product = raw.trim();
  let warrantyYears: number | null = null;
  let warrantyPrice: number | null = null;

  const match = product.match(WARRANTY_PATTERN);
  if (match) {
    const yearsValue = Number.parseInt(match[1], 10);
    if (yearsValue >= 1 && yearsValue <= 10) {
      warrantyYears = yearsValue;
      if (match[2]) warrantyPrice = Number.parseFloat(match[2].replace(",", "."));
      product = product.replace(match[0], " ");
    }
  }

  return { product: product.replace(/\s+/g, " ").trim(), warrantyYears, warrantyPrice };
}

export const EXAMPLE_QUERIES = [
  "Samsung UE75NU8000",
  "iPhone 13",
  "Bosch WAN28160BY +3 70,90€",
];
