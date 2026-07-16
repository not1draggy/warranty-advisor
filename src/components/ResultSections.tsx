import type { Product, WarrantyTier } from "../data/mockProducts";

const eur = (n: number) =>
  n.toLocaleString("sk-SK", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export function ProductCard({ product, live }: { product: Product; live: boolean }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">
            {product.brand}
          </span>
          <h2 className="text-2xl font-semibold">{product.model}</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            live ? "bg-brand-soft text-brand-dark" : "bg-slate-100 text-slate-500"
          }`}
        >
          {live ? "Živé dáta z webu" : "Ukážkové dáta"}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {product.category} · Rok uvedenia {product.releaseYear}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {product.specs.map((s) => (
          <span
            key={s}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SummaryBanner({ product, tier }: { product: Product; tier: WarrantyTier }) {
  return (
    <div className="animate-fade-up rounded-2xl bg-brand-soft p-6">
      <p className="text-xs font-medium tracking-widest text-brand-dark uppercase">
        Priemerná cena opravy po záruke
      </p>
      <p className="mt-1 text-4xl font-semibold text-brand-dark">
        {eur(product.avgRepairRange[0])} – {eur(product.avgRepairRange[1])} €
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 border-t border-brand/15 pt-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium tracking-widest text-slate-500 uppercase">
            Najčastejšia porucha
          </p>
          <p className="mt-1 font-medium text-slate-800">{product.mostCommonFailure}</p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-widest text-slate-500 uppercase">
            Predĺžená záruka
          </p>
          <p className="mt-1 font-medium text-slate-800">
            +{tier.years} {tier.years === 1 ? "rok" : tier.years < 5 ? "roky" : "rokov"} ·{" "}
            {eur(tier.price)} €
          </p>
        </div>
      </div>
    </div>
  );
}

export function ComponentRiskOverview({ product }: { product: Product }) {
  return (
    <div className="animate-fade-up grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold">Najrizikovejšie komponenty</h3>
        <ul className="mt-3 space-y-2">
          {product.riskyComponents.map((c) => (
            <li key={c} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              {c}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold">Menej rizikové komponenty</h3>
        <ul className="mt-3 space-y-2">
          {product.saferComponents.map((c) => (
            <li key={c} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Disclaimer({ live }: { live: boolean }) {
  const today = new Date().toLocaleDateString("sk-SK", { month: "long", year: "numeric" });
  return (
    <div className="flex gap-3 rounded-2xl bg-slate-50 p-5 text-xs leading-relaxed text-slate-500">
      <span aria-hidden="true" className="mt-0.5 text-slate-400">
        ⓘ
      </span>
      <p>
        Údaje sú orientačné a vychádzajú z verejne dostupných zdrojov. Nejde o záruku budúcich
        porúch ani o záväznú cenovú ponuku.{" "}
        {!live && "Zobrazené sú ukážkové dáta na demonštráciu funkcionality. "}
        Aktualizované: {today}.
      </p>
    </div>
  );
}
