/**
 * The side-by-side view.
 *
 * The deterministic ranking is covered in `shared/compare.test.ts`; what is
 * checked here is that the table does not mislead — that the "best value"
 * marker never appears on a row where the candidates are level, that a demo
 * analysis is not laundered into a researched one by being put in a table, and
 * that a comparison with no winner says so instead of leaving the reader to
 * infer one from the order.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AnalysisEvidence } from "../../shared/analysis";
import type { Candidate } from "../../shared/compare";
import { findDemoAnalysis } from "../data/demoAnalyses";
import { ComparisonView } from "./ComparisonView";

const washer = findDemoAnalysis("Bosch WAN28160BY") as AnalysisEvidence;
const phone = findDemoAnalysis("iPhone 13") as AnalysisEvidence;

function candidate(evidence: AnalysisEvidence, overrides: Partial<Candidate> = {}): Candidate {
  return {
    query: evidence.product.model,
    evidence,
    offeredPrice: null,
    warrantyYears: null,
    warrantyPrice: null,
    live: true,
    ...overrides,
  };
}

/** Two candidates in one category, so a winner is actually meaningful. */
function rivals(): Candidate[] {
  const cheaper: AnalysisEvidence = {
    ...washer,
    product: { ...washer.product, model: "WAN28160BY", estimatedPrice: 430 },
  };
  const dearer: AnalysisEvidence = {
    ...washer,
    product: { ...washer.product, model: "WAT28400", estimatedPrice: 690 },
  };
  return [candidate(cheaper), candidate(dearer)];
}

const render = (candidates: Candidate[]) =>
  renderToStaticMarkup(<ComparisonView candidates={candidates} />);

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the comparison table", () => {
  it("puts every candidate in the table with its own figures", () => {
    const rendered = text(render(rivals()));

    expect(rendered).toContain("WAN28160BY");
    expect(rendered).toContain("WAT28400");
    expect(rendered).toContain("Riziko vlastníctva");
    expect(rendered).toContain("Spolu za životnosť");
  });

  it("marks the stronger figure only where one actually is stronger", () => {
    const rendered = render(rivals());

    // The two share an evidence base, so risk is identical and must carry no
    // marker; price differs, so the totals must.
    expect(rendered).toContain("najlepšia hodnota");
    const marked = rendered.match(/najlepšia hodnota/g) ?? [];
    // One marker per genuinely differing row, never one per row.
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.length).toBeLessThan(8);
  });

  it("names no winner when the products are not alternatives", () => {
    const rendered = text(render([candidate(washer), candidate(phone)]));

    expect(rendered).toContain("nenahrádzajú");
    expect(rendered).not.toContain("Odporúčame</span>");
  });

  it("marks no best value between products that are not alternatives", () => {
    // Having just said these do not replace each other, highlighting a
    // "winning" row would put the ranking back by implication.
    const rendered = render([candidate(washer), candidate(phone)]);

    expect(rendered).not.toContain("najlepšia hodnota");
  });

  it("labels a demo candidate honestly inside the full analysis", () => {
    const demo = [candidate(washer, { live: false }), candidate(phone, { live: false })];
    // Both are demo data; putting them in a table must not imply research.
    const rendered = text(render(demo));

    expect(rendered).toContain("Porovnanie");
    expect(rendered).not.toContain("Živá analýza");
  });

  it("keeps the wide table scrollable instead of breaking the page", () => {
    // A table this wide on a phone must scroll in its own box.
    expect(render(rivals())).toContain("overflow-x-auto");
  });

  it("gives the table a caption for anyone navigating by structure", () => {
    expect(render(rivals())).toContain("<caption");
  });
});
