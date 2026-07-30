import type { FailureReason } from "../lib/api";
import { EXAMPLE_QUERIES } from "../lib/query";

/**
 * Copy for states where no analysis exists yet.
 *
 * These describe what the system did, never what the evidence lacks — a thin
 * evidence base still produces a verdict, so it never lands here.
 */
const MESSAGES: Record<FailureReason, { title: string; body: string }> = {
  unavailable: {
    title: "Živá analýza zatiaľ nie je zapnutá",
    body: "Táto inštalácia nemá nastavený prístup k analytickej službe. Vyskúšajte niektorý z ukážkových výrobkov nižšie.",
  },
  rate_limited: {
    title: "Priveľa požiadaviek za sebou",
    body: "Chvíľu počkajte a skúste analýzu spustiť znova.",
  },
  timeout: {
    title: "Analýza trvala dlhšie, než je bežné",
    body: "Zdroje sa nepodarilo prejsť v očakávanom čase. Skúste to prosím znova.",
  },
  network: {
    title: "Spojenie sa prerušilo",
    body: "Skontrolujte pripojenie na internet a skúste to znova.",
  },
  refused: {
    title: "Túto požiadavku nedokážeme spracovať",
    body: "Skúste zadať konkrétny model spotrebiča alebo elektroniky.",
  },
  unusable_response: {
    title: "Analýzu sa nepodarilo dokončiť",
    body: "Skúste to prosím znova, prípadne zadajte presnejšie označenie modelu.",
  },
  upstream_error: {
    title: "Analýzu sa nepodarilo dokončiť",
    body: "Došlo k technickej chybe na našej strane. Skúste to prosím o chvíľu znova.",
  },
};

interface Props {
  reason: FailureReason;
  onRetry: () => void;
  onPick: (query: string) => void;
}

export function StateNotice({ reason, onRetry, onPick }: Props) {
  const { title, body } = MESSAGES[reason];
  const showExamples = reason === "unavailable";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <div className="animate-rise rounded-2xl border border-line bg-surface p-6 text-center">
        <h2 className="font-medium">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>

        {showExamples ? (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => onPick(example)}
                className="rounded-full border border-line px-4 py-1.5 text-xs text-muted transition hover:border-accent hover:text-accent"
              >
                {example}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-canvas transition hover:bg-accent-strong"
          >
            Skúsiť znova
          </button>
        )}
      </div>
    </div>
  );
}
