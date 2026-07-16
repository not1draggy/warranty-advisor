import type { Failure } from "../data/mockProducts";

const RISK = {
  high: { label: "Vysoké riziko", cls: "bg-red-50 text-red-700" },
  medium: { label: "Stredné riziko", cls: "bg-amber-50 text-amber-700" },
  low: { label: "Nízke riziko", cls: "bg-slate-100 text-slate-600" },
} as const;

function authorityBadgeCls(points: number) {
  if (points >= 80) return "bg-brand-soft text-brand-dark";
  if (points >= 40) return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

function ConfidenceNote({ confidence }: { confidence: number }) {
  if (confidence >= 70) return null;
  if (confidence >= 40)
    return (
      <p className="mt-2 text-xs text-amber-700">Odhad na základe dostupných dát</p>
    );
  return (
    <p className="mt-2 text-xs text-red-600">
      Iba orientačný odhad — nedostatok priamych zdrojov pre tento model
    </p>
  );
}

export function FailureCard({ failure }: { failure: Failure }) {
  const risk = RISK[failure.riskLevel];
  const breakdown = [
    ["Diel", failure.priceBreakdown.part],
    ["Práca", failure.priceBreakdown.labor],
    ["Diagnostika", failure.priceBreakdown.diagnostics],
    ["Doprava", failure.priceBreakdown.transport],
  ] as const;

  return (
    <div className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">{failure.component}</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">~{failure.probability} %</span>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${risk.cls}`}>
            {risk.label}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {breakdown.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-0.5 text-sm font-medium">{value} €</p>
          </div>
        ))}
      </div>

      <p className="mt-4 font-semibold">
        Odhad: {failure.totalRange[0]} – {failure.totalRange[1]} €
      </p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Spoľahlivosť údajov</span>
          <span>{failure.confidence} %</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${failure.confidence}%` }}
          />
        </div>
        <ConfidenceNote confidence={failure.confidence} />
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-brand-dark select-none">
          Zdroje ({failure.sources.length})
        </summary>
        <ul className="mt-2 divide-y divide-slate-100">
          {failure.sources.map((s) => (
            <li key={s.name + s.date} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                {s.url && s.url !== "#" ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm font-medium text-slate-800 hover:text-brand-dark hover:underline"
                  >
                    {s.name}
                  </a>
                ) : (
                  <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                )}
                <p className="text-xs text-slate-400">Získané {s.date}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${authorityBadgeCls(s.authorityPoints)}`}
              >
                {s.authorityLabel} · {s.authorityPoints} b
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
