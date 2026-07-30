import { useRef } from "react";
import type { AnalysisEvidence } from "../../shared/analysis";
import {
  PARTS_AVAILABILITY,
  REPAIR_DIFFICULTY,
  WARRANTY_WORTH,
  eur,
  eurRange,
  years as formatYears,
} from "../../shared/format";
import { assessWarranty, scoreAnalysis } from "../../shared/scoring";
import type { ParsedQuery } from "../lib/query";
import { FailureCard } from "./FailureCard";
import { StickyVerdict } from "./StickyVerdict";
import { VerdictHero } from "./VerdictHero";
import { Bullets, Card, Chip, Prose, Section, Split } from "./ui";

const STANDING = {
  better: { label: "Lepšia voľba", tone: "good" },
  similar: { label: "Porovnateľné", tone: "neutral" },
  worse: { label: "Slabšia voľba", tone: "bad" },
} as const;

/** Extended-warranty verdict; only rendered when the query supplied terms. */
function WarrantyPanel({
  evidence,
  query,
}: {
  evidence: AnalysisEvidence;
  query: ParsedQuery;
}) {
  if (query.warrantyYears === null) return null;

  const price = query.warrantyPrice ?? 0;
  const assessment = assessWarranty(evidence, query.warrantyYears, price);
  const { label, detail } = WARRANTY_WORTH[assessment.worth];
  const tone = assessment.worth === "yes" ? "good" : assessment.worth === "no" ? "bad" : "warn";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{label}</h3>
        <Chip tone={tone}>
          {formatYears(query.warrantyYears)}
          {price > 0 ? ` · ${eur(price)}` : ""}
        </Chip>
      </div>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
        Zákonná záruka kryje prvé {formatYears(assessment.coversFrom)}, takže toto pripoistenie
        reálne pridáva krytie na {assessment.coversFrom + 1}. až {assessment.coversTo}. rok.{" "}
        {detail} Poruchy, ktoré v tomto okne hrozia, vychádzajú približne na{" "}
        <span className="font-medium text-ink">{eur(assessment.expectedCost)}</span>.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-subtle">{assessment.note}</p>
    </Card>
  );
}

export function AnalysisReport({
  evidence,
  query,
  live,
}: {
  evidence: AnalysisEvidence;
  query: ParsedQuery;
  live: boolean;
}) {
  const score = scoreAnalysis(evidence);
  const hero = useRef<HTMLDivElement>(null);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 pb-24">
      <StickyVerdict watch={hero} product={evidence.product} score={score} />

      <div ref={hero}>
        <VerdictHero product={evidence.product} score={score} live={live} />
      </div>

      {!live && (
        <p className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn">
          Toto je ukážková analýza na predvedenie rozhrania. Pre skutočné vyhľadávanie v servisných
          údajoch je potrebné nastaviť prístup k analytickej službe.
        </p>
      )}

      <Section title="Prečo bolo udelené toto hodnotenie">
        <Card>
          <Bullets items={score.reasons} />
          {evidence.evidenceNote && (
            <p className="mt-4 border-t border-line pt-3 text-sm leading-relaxed text-muted">
              {evidence.evidenceNote}
            </p>
          )}
        </Card>
      </Section>

      {(evidence.strengths.length > 0 || evidence.weaknesses.length > 0) && (
        <Split>
          {evidence.strengths.length > 0 && (
            <Section title="Silné stránky">
              <Card className="h-full">
                <Bullets items={evidence.strengths} tone="good" />
              </Card>
            </Section>
          )}
          {evidence.weaknesses.length > 0 && (
            <Section title="Slabé stránky">
              <Card className="h-full">
                <Bullets items={evidence.weaknesses} tone="bad" />
              </Card>
            </Section>
          )}
        </Split>
      )}

      <Section title="Čo sa môže pokaziť">
        <div className="space-y-4">
          {evidence.failures.map((failure) => (
            <FailureCard key={failure.component} failure={failure} sources={evidence.sources} />
          ))}
        </div>
      </Section>

      <Section title="Náklady na opravy">
        <Split>
          <Card>
            <p className="text-xs tracking-wide text-subtle uppercase">Bežná oprava</p>
            <p className="mt-1 text-2xl font-semibold">{eurRange(score.typicalRepairCost)}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Za 5 rokov možno očakávať náklady na opravy zhruba{" "}
              <span className="font-medium text-ink">{eur(score.expectedRepairCost)}</span>.
            </p>
          </Card>
          <Card>
            <p className="text-xs tracking-wide text-subtle uppercase">Najdrahšia možná oprava</p>
            <p className="mt-1 text-2xl font-semibold text-bad">
              {eurRange(evidence.worstCase.cost)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {evidence.worstCase.component}
              {evidence.worstCase.note ? ` — ${evidence.worstCase.note}` : ""}
            </p>
          </Card>
        </Split>
      </Section>

      <Section title="Opraviteľnosť">
        <Split>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs tracking-wide text-subtle uppercase">Náhradné diely</p>
              <Chip
                tone={
                  evidence.partsAvailability.rating === "good"
                    ? "good"
                    : evidence.partsAvailability.rating === "poor"
                      ? "bad"
                      : "warn"
                }
              >
                {PARTS_AVAILABILITY[evidence.partsAvailability.rating]}
              </Chip>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {evidence.partsAvailability.note}
            </p>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs tracking-wide text-subtle uppercase">Náročnosť opravy</p>
              <Chip
                tone={
                  evidence.repairDifficulty.rating === "low"
                    ? "good"
                    : evidence.repairDifficulty.rating === "high"
                      ? "bad"
                      : "warn"
                }
              >
                {REPAIR_DIFFICULTY[evidence.repairDifficulty.rating]}
              </Chip>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {evidence.repairDifficulty.note}
            </p>
          </Card>
        </Split>
      </Section>

      {(evidence.serviceExperience || evidence.ownerExperience) && (
        <Split>
          {evidence.serviceExperience && (
            <Section title="Skúsenosti servisov">
              <Card className="h-full">
                <Prose>{evidence.serviceExperience}</Prose>
              </Card>
            </Section>
          )}
          {evidence.ownerExperience && (
            <Section title="Skúsenosti majiteľov">
              <Card className="h-full">
                <Prose>{evidence.ownerExperience}</Prose>
              </Card>
            </Section>
          )}
        </Split>
      )}

      {evidence.competitors.length > 0 && (
        <Section title="Porovnanie s konkurenciou">
          <Card>
            <ul className="divide-y divide-line">
              {evidence.competitors.map((competitor) => (
                <li
                  key={competitor.name}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{competitor.name}</p>
                    <p className="text-sm text-muted">{competitor.note}</p>
                  </div>
                  <Chip tone={STANDING[competitor.standing].tone}>
                    {STANDING[competitor.standing].label}
                  </Chip>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}

      <Section title="Oplatí sa kúpiť?">
        <div className="space-y-4">
          <Card>
            <Prose>{evidence.summary}</Prose>
          </Card>
          <WarrantyPanel evidence={evidence} query={query} />
        </div>
      </Section>

      {(evidence.goodFor.length > 0 || evidence.notGoodFor.length > 0) && (
        <Split>
          {evidence.goodFor.length > 0 && (
            <Section title="Pre koho je vhodný">
              <Card className="h-full">
                <Bullets items={evidence.goodFor} tone="good" />
              </Card>
            </Section>
          )}
          {evidence.notGoodFor.length > 0 && (
            <Section title="Pre koho vhodný nie je">
              <Card className="h-full">
                <Bullets items={evidence.notGoodFor} tone="bad" />
              </Card>
            </Section>
          )}
        </Split>
      )}

      <p className="text-xs leading-relaxed text-subtle">
        Hodnotenie je odborný odhad na základe verejne dostupných údajov, konštrukcie výrobku a
        skúseností servisov. Nejde o záruku budúcich porúch, o záväznú cenovú ponuku ani o finančné
        poradenstvo.
      </p>
    </div>
  );
}
