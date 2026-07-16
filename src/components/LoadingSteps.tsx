import { useEffect, useState } from "react";

const STEPS = [
  "Identifikujem produkt…",
  "Prehľadávam servisné cenníky…",
  "Analyzujem hlásené poruchy…",
  "Overujem zdroje a počítam spoľahlivosť…",
];

const STEP_MS = 900;
export const LOADING_MIN_MS = STEPS.length * STEP_MS;

export function LoadingSteps() {
  const [done, setDone] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setDone((d) => Math.min(d + 1, STEPS.length));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-8" role="status" aria-live="polite">
      <ul className="space-y-3">
        {STEPS.map((step, i) => {
          const isDone = i < done;
          const isActive = i === done;
          return (
            <li
              key={step}
              className={`flex items-center gap-3 text-sm transition ${
                isDone ? "text-slate-900" : isActive ? "text-slate-600" : "text-slate-300"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  isDone
                    ? "bg-brand-soft text-brand"
                    : isActive
                      ? "border border-slate-300"
                      : "border border-slate-200"
                }`}
              >
                {isDone ? "✓" : ""}
                {isActive && (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
                )}
              </span>
              {step}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
