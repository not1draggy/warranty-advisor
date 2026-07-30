import { useState } from "react";
import { EXAMPLE_QUERIES } from "../lib/query";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  onSearch: (query: string) => void;
  busy: boolean;
  compact: boolean;
}

export function SearchHero({ onSearch, busy, compact }: Props) {
  const [value, setValue] = useState("");

  const submit = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || busy) return;
    setValue(trimmed);
    onSearch(trimmed);
  };

  return (
    <header className={`mx-auto w-full max-w-3xl px-4 print:hidden ${compact ? "pt-6 pb-8" : "pt-14 pb-10"}`}>
      <div className="mb-6 flex justify-end">
        <ThemeToggle />
      </div>

      {!compact && (
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Oplatí sa tento výrobok kúpiť?
          </h1>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted">
            Zadajte model a dostanete odborné hodnotenie spoľahlivosti, najčastejších porúch a
            reálnych cien opráv.
          </p>
        </div>
      )}

      <form
        className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
      >
        <label htmlFor="product-query" className="sr-only">
          Model výrobku
        </label>
        <input
          id="product-query"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Napr. Bosch WAN28160BY"
          maxLength={120}
          autoComplete="off"
          disabled={busy}
          className="h-12 flex-1 rounded-xl border border-line bg-surface px-4 text-[0.9375rem] outline-none transition placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || value.trim().length === 0}
          className="h-12 rounded-xl bg-accent px-6 text-[0.9375rem] font-medium text-canvas transition hover:bg-accent-strong disabled:opacity-50"
        >
          {busy ? "Analyzujem…" : "Analyzovať"}
        </button>
      </form>

      {!compact && (
        <>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={busy}
                onClick={() => submit(example)}
                className="rounded-full border border-line px-4 py-1.5 text-xs text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
          <p className="mt-5 text-center text-xs leading-relaxed text-subtle">
            Prehľadáme servisné cenníky, technické fóra a skúsenosti majiteľov. Dôkladná analýza
            trvá jednu až tri minúty.
            <br />
            Máte konkrétnu ponuku? Pripíšte cenu — <span className="font-mono">349€</span> — a ak
            zvažujete aj predĺženú záruku, jej dĺžku a cenu:{" "}
            <span className="font-mono">+3 70,90€</span>
          </p>
        </>
      )}
    </header>
  );
}
