import { VERDICT } from "../../shared/format";
import type { HistoryEntry } from "../lib/history";
import { VERDICT_TONE } from "./verdict";

interface Props {
  entries: HistoryEntry[];
  onPick: (query: string) => void;
  onClear: () => void;
}

/**
 * The shortlist a buyer is working through. Revisiting is instant because the
 * analysis is already cached, so this is the cheapest way back to a comparison.
 */
export function RecentAnalyses({ entries, onPick, onClear }: Props) {
  if (entries.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-xl">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
          Nedávno analyzované
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-subtle transition hover:text-accent"
        >
          Vymazať
        </button>
      </div>

      <ul className="space-y-2">
        {entries.map((entry) => {
          const verdict = VERDICT[entry.verdict];
          const tone = VERDICT_TONE[entry.verdict];

          return (
            <li key={entry.query}>
              <button
                type="button"
                onClick={() => onPick(entry.query)}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-left transition hover:border-accent"
              >
                <span aria-hidden="true">{verdict.icon}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{entry.model}</span>
                <span className="sr-only">{verdict.label},</span>
                <span className="shrink-0 text-xs text-subtle">
                  Riziko{" "}
                  <span className="font-semibold" style={{ color: tone.stroke }}>
                    {entry.risk}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
