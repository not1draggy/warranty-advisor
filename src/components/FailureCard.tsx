import type { Failure, Source } from "../../shared/analysis";
import {
  REPAIR_DIFFICULTY,
  RISK_LEVEL,
  SOURCE_AUTHORITY,
  eurRange,
  formatSourceDate,
  onsetLabel,
} from "../../shared/format";
import { BasisChip, Card, Chip, Meter } from "./ui";

const RISK_TONE = {
  high: { chip: "bad", bar: "var(--bad)" },
  medium: { chip: "warn", bar: "var(--warn)" },
  low: { chip: "neutral", bar: "var(--ink-muted)" },
} as const;

function SourceList({ sources }: { sources: Source[] }) {
  return (
    <details className="mt-4 border-t border-line pt-3">
      <summary className="cursor-pointer text-sm text-accent select-none">
        Zdroje ({sources.length})
      </summary>
      <ul className="mt-2 space-y-2">
        {sources.map((source) => (
          <li key={source.id} className="flex flex-wrap items-center justify-between gap-2">
            <a
              href={source.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 truncate text-sm text-ink/90 underline decoration-line underline-offset-4 hover:text-accent"
            >
              {source.name}
            </a>
            <span className="text-xs text-subtle">
              {SOURCE_AUTHORITY[source.authority]} · {formatSourceDate(source.date)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function FailureCard({ failure, sources }: { failure: Failure; sources: Source[] }) {
  const tone = RISK_TONE[failure.riskLevel];
  const cited = sources.filter((source) => failure.sourceIds.includes(source.id));
  const onset = onsetLabel(failure.onsetYears);

  return (
    <Card className="animate-rise">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 className="font-medium">{failure.component}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <BasisChip basis={failure.basis} />
          <Chip tone={tone.chip}>{RISK_LEVEL[failure.riskLevel]}</Chip>
        </div>
      </div>

      {failure.description && (
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{failure.description}</p>
      )}

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs text-muted">
          <span>Odhadovaná pravdepodobnosť počas životnosti</span>
          <span className="font-medium text-ink">{failure.probability} %</span>
        </div>
        <div className="mt-1.5">
          <Meter
            value={failure.probability}
            label={`Pravdepodobnosť poruchy: ${failure.component}`}
            color={tone.bar}
          />
        </div>
      </div>

      {failure.frequency && (
        <p className="mt-3 text-sm leading-relaxed text-muted">{failure.frequency}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line pt-3">
        <div>
          <p className="text-xs text-subtle">Odhad ceny opravy</p>
          <p className="font-medium">{eurRange(failure.repairCost)}</p>
        </div>
        <div>
          <p className="text-xs text-subtle">Náročnosť</p>
          <p className="font-medium">{REPAIR_DIFFICULTY[failure.difficulty]}</p>
        </div>
        {onset && (
          <div>
            <p className="text-xs text-subtle">Kedy sa objaví</p>
            <p className="font-medium">{onset}</p>
          </div>
        )}
      </div>

      {cited.length > 0 && <SourceList sources={cited} />}
    </Card>
  );
}
