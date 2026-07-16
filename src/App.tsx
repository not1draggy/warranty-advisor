import { useRef, useState } from "react";
import { SearchHero } from "./components/SearchHero";
import { LoadingSteps, LOADING_MIN_MS } from "./components/LoadingSteps";
import {
  ProductCard,
  SummaryBanner,
  ComponentRiskOverview,
  Disclaimer,
} from "./components/ResultSections";
import { FailureCard } from "./components/FailureCard";
import { Recommendation } from "./components/Recommendation";
import { EmptyState } from "./components/EmptyState";
import { search } from "./lib/search";
import type { Product, WarrantyTier } from "./data/mockProducts";

type View =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; product: Product; tier: WarrantyTier; live: boolean }
  | { kind: "notfound" };

export default function App() {
  const [view, setView] = useState<View>({ kind: "idle" });
  const searchSeq = useRef(0);

  const runSearch = async (query: string) => {
    const seq = ++searchSeq.current;
    setView({ kind: "loading" });
    const startedAt = Date.now();

    const outcome = await search(query);

    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, LOADING_MIN_MS - elapsed);
    await new Promise((r) => setTimeout(r, remaining));

    if (seq !== searchSeq.current) return;

    if (outcome.status === "found") {
      setView({
        kind: "result",
        product: outcome.result.product,
        tier: outcome.result.selectedTier,
        live: outcome.live,
      });
    } else {
      setView({ kind: "notfound" });
    }
  };

  return (
    <main className="min-h-screen">
      <SearchHero onSearch={runSearch} disabled={view.kind === "loading"} />

      {view.kind === "loading" && <LoadingSteps />}
      {view.kind === "notfound" && <EmptyState onPick={runSearch} />}

      {view.kind === "result" && (
        <section className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-20">
          <ProductCard product={view.product} live={view.live} />
          <SummaryBanner product={view.product} tier={view.tier} />

          <div>
            <h3 className="mb-3 font-semibold">Zoznam porúch podľa rizika</h3>
            <div className="space-y-4">
              {view.product.failures.map((f) => (
                <FailureCard key={f.component} failure={f} />
              ))}
            </div>
          </div>

          <ComponentRiskOverview product={view.product} />
          <Disclaimer live={view.live} />
          <Recommendation product={view.product} tier={view.tier} />
        </section>
      )}

      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        Warranty Advisor · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
