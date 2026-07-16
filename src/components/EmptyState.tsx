import { EXAMPLE_QUERIES } from "../data/mockProducts";

export function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <div className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">
          Tento produkt sa nepodarilo nájsť. Skontrolujte model, alebo vyskúšajte jeden z
          ukážkových produktov.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPick(q)}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-xs text-slate-600 transition hover:border-brand hover:text-brand"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
