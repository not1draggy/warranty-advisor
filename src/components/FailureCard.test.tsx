/**
 * A single predicted failure, as the reader sees it.
 *
 * This card once contradicted itself: it quoted a probability "do 5 rokov"
 * beside an onset of "7. až 10. roku". A source-text sweep guards the wording;
 * this checks the rendered pairing, which is what a reader actually meets.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Failure, Source } from "../../shared/analysis";
import { FailureCard } from "./FailureCard";

const failure = (overrides: Partial<Failure> = {}): Failure => ({
  component: "Ložiská bubna",
  description: "Hluk pri odstreďovaní.",
  riskLevel: "high",
  probability: 26,
  frequency: "Po siedmich rokoch prevádzky.",
  onsetYears: [7, 10],
  repairCost: [180, 250],
  preventable: false,
  basis: "fact",
  difficulty: "high",
  sourceIds: ["s1"],
  ...overrides,
});

const sources: Source[] = [
  {
    id: "s1",
    name: "Cenník autorizovaného servisu",
    url: "https://example.com/cennik",
    authority: "authorized_service",
    date: "2026-02-01",
  },
];

const render = (f: Failure = failure(), s: Source[] = sources) =>
  renderToStaticMarkup(<FailureCard failure={f} sources={s} />);

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("a predicted failure", () => {
  it("does not contradict itself about when the fault arrives", () => {
    // A lifetime probability beside a late onset is coherent. The same number
    // labelled as a five-year probability is not, and that is what shipped.
    const rendered = text(render());

    expect(rendered).toContain("pravdepodobnosť počas životnosti");
    expect(rendered).toContain("26 %");
    expect(rendered).toContain("Typicky v 7. až 10. roku");
    expect(rendered).not.toMatch(/pravdepodobnos.{0,30}5 rokov/i);
  });

  it("says nothing about timing when the fault has none", () => {
    // Accidental damage has no characteristic year; inventing one would be a
    // claim the evidence does not support.
    const rendered = text(render(failure({ onsetYears: null })));

    expect(rendered).not.toContain("Kedy sa objaví");
    expect(rendered).toContain("26 %");
  });

  it("carries the cost, difficulty and how the claim is grounded", () => {
    const rendered = text(render());

    expect(rendered).toContain("180 – 250 €");
    expect(rendered).toContain("Náročná oprava");
    expect(rendered).toContain("Overený údaj");
  });

  it("distinguishes a cited fact from a reasoned one", () => {
    expect(text(render(failure({ basis: "assumption" })))).toContain("Odborná úvaha");
    expect(text(render(failure({ basis: "estimate" })))).toContain("Kvalifikovaný odhad");
  });

  it("shows only the sources this failure actually cites", () => {
    const extra: Source = { ...sources[0], id: "s2", name: "Nesúvisiaci zdroj" };
    const rendered = text(render(failure(), [...sources, extra]));

    expect(rendered).toContain("Cenník autorizovaného servisu");
    expect(rendered).not.toContain("Nesúvisiaci zdroj");
    expect(rendered).toContain("Zdroje (1)");
  });

  it("offers no source list at all when nothing is cited", () => {
    // An empty disclosure implying evidence exists would be worse than none.
    expect(text(render(failure({ sourceIds: [] })))).not.toContain("Zdroje (");
  });

  it("says when the owner can head a fault off", () => {
    // The one kind of risk a buyer can act on, so it must not be buried in
    // prose with everything they cannot.
    expect(text(render(failure({ preventable: true })))).toContain("Dá sa predísť údržbou");
    expect(text(render(failure({ preventable: false })))).not.toContain("Dá sa predísť");
  });

  it("gives the probability bar a reading for anyone who cannot see it", () => {
    expect(render()).toContain("Pravdepodobnosť poruchy: Ložiská bubna");
  });
});
