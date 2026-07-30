/**
 * Renders the report and checks what it actually says.
 *
 * The specification fixes which sections an analysis must contain — a buyer is
 * promised the worst-case repair, who the product is not for, and so on — and
 * nothing until now asserted they appear. Several are also conditional, so a
 * mistake in one condition would quietly drop a section rather than break
 * anything visible in development.
 *
 * Static rendering keeps this dependency-free: no browser, no DOM library. It
 * covers content and the render path, not interaction.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AnalysisEvidence } from "../../shared/analysis";
import { findDemoAnalysis } from "../data/demoAnalyses";
import { scoreAnalysis } from "../../shared/scoring";
import { VERDICT } from "../../shared/format";
import { parseQuery } from "../lib/query";
import { AnalysisReport } from "./AnalysisReport";

const evidence = findDemoAnalysis("Bosch WAN28160BY") as AnalysisEvidence;

function render(query = "Bosch WAN28160BY", live = true): string {
  return renderToStaticMarkup(
    <AnalysisReport evidence={evidence} query={parseQuery(query)} live={live} />,
  );
}

/** Strips tags so assertions match text the reader sees, not markup. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/** Every section the analysis is required to deliver. */
const REQUIRED_SECTIONS = [
  "Prečo bolo udelené toto hodnotenie",
  "Silné stránky",
  "Slabé stránky",
  "Čo sa môže pokaziť",
  "Náklady na opravy",
  "Najdrahšia možná oprava",
  "Náhradné diely",
  "Náročnosť opravy",
  "Skúsenosti servisov",
  "Skúsenosti majiteľov",
  "Porovnanie s konkurenciou",
  "Oplatí sa kúpiť?",
  "Pre koho je vhodný",
  "Pre koho vhodný nie je",
];

describe("the analysis a buyer is handed", () => {
  it("contains every section the analysis promises", () => {
    const rendered = text(render());
    const missing = REQUIRED_SECTIONS.filter((section) => !rendered.includes(section));

    expect(missing).toEqual([]);
  });

  it("states one recommendation, and it is the computed one", () => {
    const rendered = text(render());
    const expected = VERDICT[scoreAnalysis(evidence).verdict].label;

    expect(rendered).toContain(expected);

    // Only one of the three may be on the page, or the reader has no answer.
    // "Odporúčame kúpu" is a prefix of "Odporúčame kúpu s výhradami", so the
    // others count only where they stand on their own.
    const others = Object.values(VERDICT)
      .map((v) => v.label)
      .filter((label) => label !== expected && !expected.includes(label));

    for (const label of others) expect(rendered, label).not.toContain(label);
  });

  it("shows the risk and confidence figures the scorer produced", () => {
    const score = scoreAnalysis(evidence);
    const rendered = text(render());

    expect(rendered).toContain(String(score.ownershipRisk));
    expect(rendered).toContain(`${score.confidence}`);
  });

  it("names every failure the evidence carries", () => {
    const rendered = text(render());

    for (const failure of evidence.failures) {
      expect(rendered, failure.component).toContain(failure.component);
    }
  });

  it("links the sources of a researched analysis", () => {
    // Demo analyses deliberately carry none — they are not researched, so they
    // must not display a source list at all.
    expect(text(render())).not.toContain("Zdroje analýzy");

    const researched: AnalysisEvidence = {
      ...evidence,
      sources: [
        {
          id: "s1",
          name: "Cenník autorizovaného servisu",
          url: "https://example.com/cennik",
          authority: "authorized_service",
          date: "2026-02-01",
        },
      ],
    };
    const html = renderToStaticMarkup(
      <AnalysisReport evidence={researched} query={parseQuery("Bosch WAN28160BY")} live />,
    );

    expect(text(html)).toContain("Zdroje analýzy");
    expect(text(html)).toContain("Cenník autorizovaného servisu");
    expect(html).toContain('href="https://example.com/cennik"');
    // An outbound link from a report must not hand the opener window over.
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("says outright when the analysis is only a demonstration", () => {
    expect(text(render("Bosch WAN28160BY", false))).toContain("ukážková analýza");
    expect(text(render("Bosch WAN28160BY", true))).not.toContain("ukážková analýza");
  });
});

describe("the span the estimates cover", () => {
  it("names the service life beside the lifetime repair figure", () => {
    const rendered = text(render());
    const life = evidence.product.serviceLifeYears;

    expect(rendered).toContain(`${life} rokov`);
    // The bare word tells the reader nothing they can use.
    expect(rendered).not.toContain("opravy počas životnosti");
  });
});

describe("the price the report rests on", () => {
  it("always shows which price the totals were built from", () => {
    expect(text(render())).toContain("odhad bežnej trhovej ceny");
    expect(text(render("Bosch WAN28160BY 349€"))).toContain("zadaná cena");
  });

  it("prices the buyer's own offer when they give one", () => {
    const rendered = text(render("Bosch WAN28160BY 349€"));

    expect(rendered).toContain("349 €");
    expect(rendered).toContain("Cena pod bežnou úrovňou");
  });

  it("does not claim a deal when no offer was given", () => {
    const rendered = text(render());

    expect(rendered).not.toContain("Cena pod bežnou úrovňou");
    expect(rendered).not.toContain("Cena nad bežnou úrovňou");
  });
});

describe("the extended-warranty verdict", () => {
  it("appears only once terms have been supplied", () => {
    expect(text(render())).not.toContain("Predĺžená záruka");
    expect(text(render("Bosch WAN28160BY +3 70,90€"))).toContain("Predĺžená záruka");
  });

  it("explains what the cover actually adds beyond the statutory two years", () => {
    const rendered = text(render("Bosch WAN28160BY +3 70,90€"));

    expect(rendered).toContain("Zákonná záruka kryje prvé 2 roky");
    expect(rendered).toContain("3. až 5. rok");
  });
});

describe("the report as a whole", () => {
  it("renders every product in the demo catalogue without failing", () => {
    // These are the analyses anyone lands on before a key is configured, so a
    // shape that only one of them has must not take the page down.
    for (const query of ["Samsung UE75NU8000", "iPhone 13", "Bosch WAN28160BY"]) {
      const demo = findDemoAnalysis(query) as AnalysisEvidence;
      expect(demo, query).not.toBeNull();
      expect(() =>
        renderToStaticMarkup(
          <AnalysisReport evidence={demo} query={parseQuery(query)} live={false} />,
        ),
      ).not.toThrow();
    }
  });

  it("carries the disclaimer that this is judgement, not a guarantee", () => {
    expect(text(render())).toContain("Nejde o záruku budúcich porúch");
  });
});
