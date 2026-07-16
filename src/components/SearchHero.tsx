import { useState } from "react";
import { EXAMPLE_QUERIES } from "../data/mockProducts";

interface Props {
  onSearch: (query: string) => void;
  disabled: boolean;
}

export function SearchHero({ onSearch, disabled }: Props) {
  const [value, setValue] = useState("");

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || disabled) return;
    setValue(trimmed);
    onSearch(trimmed);
  };

  return (
    <header className="mx-auto w-full max-w-3xl px-4 pt-16 pb-10 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Zistite riziko opravy skôr, ako sa rozhodnete
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-slate-500">
        Zadajte model produktu a AI vám ukáže najčastejšie poruchy a reálne ceny opráv z overených
        servisov.
      </p>

      <form
        className="mx-auto mt-8 flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Napr. Samsung UE75NU8000 +3 70,90€"
          disabled={disabled}
          className="h-12 flex-1 rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled}
          className="h-12 rounded-xl bg-brand px-6 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          Analyzovať
        </button>
      </form>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {EXAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => submit(q)}
            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs text-slate-600 transition hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {q}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Tip: pridajte dĺžku a cenu záruky priamo do vyhľadávania, napr.{" "}
        <span className="font-mono">+3 70,90€</span>
      </p>
    </header>
  );
}
