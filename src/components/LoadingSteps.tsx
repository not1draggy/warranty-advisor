import { useEffect, useState } from "react";

/**
 * Progress for a research job that typically runs one to three minutes.
 * The last step stays active until the job actually finishes, so the list
 * never claims to be done before it is.
 */
const STEPS = [
  "Identifikujem výrobok",
  "Prehľadávam servisné údaje a cenníky",
  "Porovnávam s podobnými modelmi",
  "Vyhodnocujem poruchy a náklady",
];

const STEP_MS = 9_000;
/** Past this the wait is unusual, so say something more than the estimate. */
const PATIENCE_MS = 90_000;

export function LoadingSteps() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 1_000);
    return () => clearInterval(timer);
  }, []);

  const active = Math.min(Math.floor(elapsed / STEP_MS), STEPS.length - 1);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6" role="status" aria-live="polite">
      <ul className="space-y-3.5">
        {STEPS.map((step, index) => {
          const done = index < active;
          const current = index === active;

          return (
            <li
              key={step}
              className={`flex items-center gap-3 text-[0.9375rem] transition-colors ${
                done ? "text-muted" : current ? "text-ink" : "text-subtle/60"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                  done
                    ? "bg-accent-soft text-accent"
                    : current
                      ? "border border-accent"
                      : "border border-line"
                }`}
              >
                {done ? "✓" : current ? <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> : null}
              </span>
              {step}
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-sm leading-relaxed text-subtle">
        {elapsed > PATIENCE_MS
          ? "Tento model si vyžaduje dôkladnejšie hľadanie. Výsledok sa zobrazí hneď, ako bude hotový — stránku môžete nechať otvorenú na pozadí."
          : "Analýza trvá jednu až tri minúty. Pokojne prepnite na inú kartu, v názve karty uvidíte, keď bude hotová."}
      </p>
    </div>
  );
}
