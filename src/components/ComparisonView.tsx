import { useState } from "react";
import { PARTS_AVAILABILITY, REPAIR_DIFFICULTY, VERDICT, eur } from "../../shared/format";
import { compareCandidates, type Candidate, type RankedCandidate } from "../../shared/compare";
import { AnalysisReport } from "./AnalysisReport";
import { ShareButton } from "./ShareButton";
import { VERDICT_TONE } from "./verdict";
import { Card, Chip, Section } from "./ui";

/** Rows of the comparison table, in the order a buyer weighs them. */
const ROWS: {
  label: string;
  value: (c: RankedCandidate) => string;
  /** Lower is better, for the marker on the strongest cell. */
  compare?: (c: RankedCandidate) => number;
}[] = [
  {
    label: "Riziko vlastníctva",
    value: (c) => `${c.score.ownershipRisk} / 100`,
    compare: (c) => c.score.ownershipRisk,
  },
  { label: "Spoľahlivosť odhadu", value: (c) => `${c.score.confidence} %` },
  {
    label: "Cena výrobku",
    value: (c) => eur(c.offeredPrice ?? c.evidence.product.estimatedPrice),
  },
  {
    label: "Očakávané opravy",
    value: (c) => eur(c.score.expectedRepairCost),
    compare: (c) => c.score.expectedRepairCost,
  },
  { label: "Spolu za životnosť", value: (c) => eur(c.totalCost), compare: (c) => c.totalCost },
  {
    label: "Najdrahšia oprava",
    value: (c) => eur(c.evidence.worstCase.cost[1]),
    compare: (c) => c.evidence.worstCase.cost[1],
  },
  {
    label: "Náhradné diely",
    value: (c) => PARTS_AVAILABILITY[c.evidence.partsAvailability.rating],
  },
  {
    label: "Náročnosť opravy",
    value: (c) => REPAIR_DIFFICULTY[c.evidence.repairDifficulty.rating],
  },
];

function Heading({ candidate, winner }: { candidate: RankedCandidate; winner: boolean }) {
  const verdict = VERDICT[candidate.score.verdict];
  const tone = VERDICT_TONE[candidate.score.verdict];

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{candidate.evidence.product.model}</span>
        {winner && <Chip tone="accent">Odporúčame</Chip>}
      </div>
      <p className={`mt-1 text-sm ${tone.text}`}>
        <span aria-hidden="true">{verdict.icon}</span> {verdict.label}
      </p>
    </div>
  );
}

export function ComparisonView({ candidates }: { candidates: Candidate[] }) {
  const comparison = compareCandidates(candidates);
  const [open, setOpen] = useState<string | null>(null);
  const ranked = comparison.candidates;

  /**
   * Marks the strongest cell in a row — never in a row that is a draw, and
   * never at all between products that are not alternatives. Having just said
   * these do not replace each other, highlighting a "winning" row would put
   * the ranking back by implication.
   */
  const bestValue = (row: (typeof ROWS)[number]) => {
    if (!row.compare || comparison.basis === "incomparable") return null;
    const values = ranked.map(row.compare);
    const lowest = Math.min(...values);
    return values.filter((v) => v === lowest).length === values.length ? null : lowest;
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 pb-24">
      <Section title="Ktorý z nich kúpiť">
        <Card>
          <div className="mb-3 flex justify-end">
            {/* A comparison is the thing people forward to whoever they are
                deciding with, and the URL already reproduces it exactly. */}
            <ShareButton />
          </div>
          {comparison.winner ? (
            <p className="text-lg font-semibold">
              <span aria-hidden="true">{VERDICT[comparison.winner.score.verdict].icon}</span>{" "}
              {comparison.winner.evidence.product.brand} {comparison.winner.evidence.product.model}
            </p>
          ) : (
            <p className="text-lg font-semibold">
              {comparison.basis === "incomparable"
                ? "Tieto výrobky sa navzájom nenahrádzajú"
                : "Rozdiel medzi nimi je zanedbateľný"}
            </p>
          )}

          <ul className="mt-3 space-y-2.5">
            {comparison.reasons.map((reason) => (
              <li key={reason} className="flex gap-3 text-[0.9375rem] leading-relaxed text-ink/90">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-subtle" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section title="Porovnanie">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[21rem] border-collapse text-sm sm:min-w-[32rem] sm:text-[0.9375rem]">
            <caption className="sr-only">
              Porovnanie hodnotenia, nákladov a opraviteľnosti kandidátov
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-24 pb-3 text-left align-bottom text-xs font-medium tracking-wide text-subtle uppercase sm:w-40">
                  Ukazovateľ
                </th>
                {ranked.map((candidate) => (
                  <th
                    key={candidate.query}
                    scope="col"
                    className="pb-3 pl-3 text-left align-bottom font-normal sm:pl-4"
                  >
                    <Heading
                      candidate={candidate}
                      winner={comparison.winner?.query === candidate.query}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const best = bestValue(row);
                return (
                  <tr key={row.label} className="border-t border-line">
                    <th scope="row" className="py-3 pr-3 text-left text-xs font-normal text-muted sm:pr-4 sm:text-sm">
                      {row.label}
                    </th>
                    {ranked.map((candidate) => {
                      const strongest = best !== null && row.compare?.(candidate) === best;
                      return (
                        <td
                          key={candidate.query}
                          className={`py-3 pl-3 tabular-nums sm:pl-4 ${strongest ? "font-semibold text-good" : ""}`}
                        >
                          {row.value(candidate)}
                          {strongest && <span className="sr-only"> — najlepšia hodnota</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        {ranked.length > 2 && (
          // Two fit a phone; three do not, and a column nobody knows is there
          // is a column nobody reads.
          <p className="mt-2 text-xs text-subtle sm:hidden">
            Tabuľku potiahnite do strany pre ďalšieho kandidáta.
          </p>
        )}
      </Section>

      <Section title="Celé analýzy">
        <div className="space-y-3">
          {ranked.map((candidate) => {
            const expanded = open === candidate.query;
            return (
              <div key={candidate.query} className="rounded-2xl border border-line bg-surface">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : candidate.query)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-medium">
                    {candidate.evidence.product.brand} {candidate.evidence.product.model}
                  </span>
                  <span className="text-sm text-accent">
                    {expanded ? "Skryť podrobnosti" : "Zobraziť podrobnosti"}
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-line pt-6">
                    <AnalysisReport
                      evidence={candidate.evidence}
                      query={{
                        product: candidate.query,
                        price: candidate.offeredPrice,
                        warrantyYears: candidate.warrantyYears,
                        warrantyPrice: candidate.warrantyPrice,
                      }}
                      live={candidate.live}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
