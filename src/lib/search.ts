import {
  findProduct,
  parseQuery,
  type Product,
  type SearchResult,
  type WarrantyTier,
} from "../data/mockProducts";

export type SearchOutcome =
  | { status: "found"; result: SearchResult; live: boolean }
  | { status: "notfound" };

const LIVE_SEARCH_TIMEOUT_MS = 25_000;

async function tryLiveSearch(productQuery: string): Promise<Product | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(productQuery)}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { product?: Product };
    if (!data.product || !Array.isArray(data.product.failures)) return null;
    return data.product;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function search(rawQuery: string): Promise<SearchOutcome> {
  const parsed = parseQuery(rawQuery);
  if (!parsed.productQuery) return { status: "notfound" };

  const liveProduct = await tryLiveSearch(parsed.productQuery);
  if (liveProduct) {
    const baseTier: WarrantyTier =
      (parsed.years != null && liveProduct.warrantyTiers?.find((t) => t.years === parsed.years)) ||
      liveProduct.warrantyTiers?.[0] || { years: parsed.years ?? 1, price: 0 };
    const selectedTier: WarrantyTier =
      parsed.priceOverride != null
        ? { years: parsed.years ?? baseTier.years, price: parsed.priceOverride }
        : baseTier;
    return { status: "found", result: { product: liveProduct, selectedTier }, live: true };
  }

  const mock = findProduct(rawQuery);
  if (mock) return { status: "found", result: mock, live: false };

  return { status: "notfound" };
}
