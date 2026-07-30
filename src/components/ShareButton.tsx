import { useEffect, useRef, useState } from "react";

type Status = "idle" | "copied" | "unavailable";

const LABELS: Record<Status, string> = {
  idle: "Zdieľať",
  copied: "Skopírované",
  unavailable: "Adresa je v paneli prehliadača",
};

const RESET_MS = 2_500;

/**
 * The analysis URL is already shareable and reloads straight from cache; this
 * is what tells the reader so. Prefers the native share sheet on mobile and
 * falls back to the clipboard.
 */
export function ShareButton() {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const announce = (next: Status) => {
    setStatus(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), RESET_MS);
  };

  const share = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch {
        // Dismissing the share sheet is not an error worth reporting.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      announce("copied");
    } catch {
      announce("unavailable");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="rounded-full border border-ink/15 px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-accent print:hidden"
    >
      <span aria-hidden="true">⇪</span>
      <span className="ml-1.5">{LABELS[status]}</span>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "idle" ? "" : LABELS[status]}
      </span>
    </button>
  );
}
