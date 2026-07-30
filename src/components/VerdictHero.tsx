import { confidenceExplanation, VERDICT, eur } from "../../shared/format";
import type { Score } from "../../shared/scoring";
import type { ProductIdentity } from "../../shared/analysis";
import { ShareButton } from "./ShareButton";
import { VERDICT_TONE } from "./verdict";

const GAUGE_RADIUS = 54;
const GAUGE_LENGTH = Math.PI * GAUGE_RADIUS;

/** Semicircular gauge for ownership risk; the arc fills clockwise from 0. */
function RiskGauge({ value, stroke }: { value: number; stroke: string }) {
  return (
    <svg viewBox="0 0 140 82" className="w-36" role="img" aria-label={`Riziko vlastníctva ${value} zo 100`}>
      <path
        d="M 16 70 A 54 54 0 0 1 124 70"
        fill="none"
        stroke="var(--line)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M 16 70 A 54 54 0 0 1 124 70"
        fill="none"
        stroke={stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={GAUGE_LENGTH}
        strokeDashoffset={GAUGE_LENGTH * (1 - value / 100)}
        style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      />
      <text x="70" y="66" textAnchor="middle" className="fill-ink text-[26px] font-semibold">
        {value}
      </text>
    </svg>
  );
}

interface Props {
  product: ProductIdentity;
  score: Score;
  live: boolean;
}

export function VerdictHero({ product, score, live }: Props) {
  const verdict = VERDICT[score.verdict];
  const tone = VERDICT_TONE[score.verdict];

  return (
    <div
      className="animate-rise rounded-3xl border border-line p-6 sm:p-8"
      // A large panel filled with amber or red reads as mud rather than as
      // meaning. Mixing a few percent of the verdict colour into the surface
      // keeps the signal while the card stays calm, in either theme.
      style={{ background: `color-mix(in oklab, ${tone.stroke} 7%, var(--surface))` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-xs font-medium tracking-widest text-muted uppercase">
            {product.brand}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{product.model}</h1>
        </div>
        <span className="flex items-center gap-3">
          <span className="text-xs text-subtle">
            {live ? "Živá analýza" : "Ukážková analýza"}
          </span>
          <ShareButton />
        </span>
      </div>

      <p className="mt-1 text-sm text-muted">
        {product.category}
        {product.releaseYear ? ` · ${product.releaseYear}` : ""}
        {product.estimatedPrice > 0 ? ` · orientačne ${eur(product.estimatedPrice)}` : ""}
      </p>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={`text-xl font-semibold sm:text-2xl ${tone.text}`}>
            <span aria-hidden="true">{verdict.icon}</span> {verdict.label}
          </p>
          <p className="mt-1.5 text-[0.9375rem] text-ink/80">{verdict.headline}</p>
        </div>

        <div className="flex shrink-0 items-center gap-5">
          <div className="text-center">
            <RiskGauge value={score.ownershipRisk} stroke={tone.stroke} />
            <p className="-mt-1 text-xs text-muted">Riziko vlastníctva</p>
          </div>
          <div className="text-center">
            <p className="text-[26px] leading-[1.35] font-semibold">{score.confidence} %</p>
            <p className="text-xs text-muted">Spoľahlivosť odhadu</p>
          </div>
        </div>
      </div>

      {product.specs.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {product.specs.map((spec) => (
            <span
              key={spec}
              className="rounded-full bg-canvas/60 px-3 py-1 text-xs font-medium text-muted"
            >
              {spec}
            </span>
          ))}
        </div>
      )}

      <p className="mt-5 border-t border-ink/10 pt-4 text-sm leading-relaxed text-muted">
        {confidenceExplanation(score.confidence)}
      </p>
    </div>
  );
}
