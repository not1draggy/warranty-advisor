import type { FailureReason } from "../lib/api";

/**
 * Copy for states where no analysis exists yet.
 *
 * These describe what the system did, never what the evidence lacks — a thin
 * evidence base still produces a verdict, so it never lands here.
 */
const MESSAGES: Record<FailureReason, { title: string; body: string }> = {
  unavailable: {
    title: "Živá analýza zatiaľ nie je zapnutá",
    body: "Táto inštalácia nemá nastavený prístup k analytickej službe. Vyskúšajte niektorý z ukážkových výrobkov vyššie.",
  },
  rate_limited: {
    title: "Priveľa požiadaviek za sebou",
    body: "Chvíľu počkajte a skúste analýzu spustiť znova.",
  },
  daily_limit: {
    title: "Dnešná kapacita analýz je vyčerpaná",
    body: "Nové analýzy budeme opäť spúšťať zajtra. Výrobky, ktoré sme už analyzovali, sa medzitým načítajú okamžite.",
  },
  worker_unavailable: {
    title: "Výskum sa nepodarilo spustiť",
    body: "Služba, ktorá analýzu vykonáva, práve neodpovedala. Skúste to prosím o chvíľu znova.",
  },
  network: {
    title: "Spojenie sa prerušilo",
    body: "Skontrolujte pripojenie na internet a skúste to znova.",
  },
  refused: {
    title: "Túto požiadavku nedokážeme spracovať",
    body: "Skúste zadať konkrétny model spotrebiča alebo elektroniky.",
  },
  still_running: {
    title: "Analýza ešte stále beží",
    body: "Tento model si vyžiadal dôkladnejšie hľadanie. Skúste to o chvíľu znova — pokračujeme tam, kde sme skončili, a hotový výsledok sa načíta okamžite.",
  },
  not_a_product: {
    title: "Toto zatiaľ nevyzerá ako výrobok",
    body: "Zadajte značku a model spotrebiča alebo elektroniky. Stačí aj samotná značka s kategóriou — napríklad „práčka Bosch“.",
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

/**
 * Reasons a fresh attempt could plausibly succeed. The rest need the user to
 * type something different, and the search box directly above — with its
 * example queries — is already the affordance for that.
 */
const RETRYABLE: ReadonlySet<FailureReason> = new Set<FailureReason>([
  "still_running",
  "rate_limited",
  "worker_unavailable",
  "network",
  "unusable_response",
  "upstream_error",
]);

interface Props {
  reason: FailureReason;
  onRetry: () => void;
}

export function StateNotice({ reason, onRetry }: Props) {
  const { title, body } = MESSAGES[reason];

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <div className="animate-rise rounded-2xl border border-line bg-surface p-6 text-center">
        <h2 className="font-medium">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>

        {RETRYABLE.has(reason) && (
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
