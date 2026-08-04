/**
 * The panel that carries the answer.
 *
 * Everything below it is supporting detail; if this is wrong or ambiguous the
 * rest does not matter. What is checked here is that it commits — one verdict,
 * both numbers, and an accessible reading of a gauge that is otherwise a
 * wordless arc.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProductIdentity } from "../../shared/analysis";
import { VERDICT } from "../../shared/format";
import type { Score } from "../../shared/scoring";
import { VerdictHero } from "./VerdictHero";

const product: ProductIdentity = {
  brand: "Bosch",
  model: "WAN28160BY",
  category: "Práčka",
  releaseYear: 2020,
  specs: ["7 kg", "1400 ot./min"],
  matchLevel: "exact",
  estimatedPrice: 430,
  priceBasis: "estimate",
  serviceLifeYears: 12,
};

const score = (overrides: Partial<Score> = {}): Score => ({
  ownershipRisk: 28,
  confidence: 71,
  verdict: "buy",
  reasons: ["Dôvod"],
  expectedRepairCost: 88,
  typicalRepairCost: [120, 250],
  ...overrides,
});

const render = (s: Score = score(), live = true) =>
  renderToStaticMarkup(<VerdictHero product={product} score={s} live={live} />);

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the verdict panel", () => {
  it("commits to exactly one of the three recommendations", () => {
    for (const kind of ["buy", "caution", "avoid"] as const) {
      const rendered = text(render(score({ verdict: kind })));
      const expected = VERDICT[kind].label;

      expect(rendered, kind).toContain(expected);

      // "Odporúčame kúpu" is a prefix of "Odporúčame kúpu s výhradami", so a
      // label only counts against this when it stands on its own.
      const others = Object.values(VERDICT)
        .map((v) => v.label)
        .filter((label) => label !== expected && !expected.includes(label));

      for (const label of others) expect(rendered, `${kind}/${label}`).not.toContain(label);
    }
  });

  it("shows both figures the verdict was computed from", () => {
    const rendered = text(render(score({ ownershipRisk: 43, confidence: 62 })));

    expect(rendered).toContain("43");
    expect(rendered).toContain("62 %");
    expect(rendered).toContain("Riziko vlastníctva");
    expect(rendered).toContain("Spoľahlivosť odhadu");
  });

  it("reads the risk gauge out for anyone who cannot see the arc", () => {
    // The gauge is a bare SVG path — without this it conveys nothing.
    expect(render(score({ ownershipRisk: 43 }))).toContain('aria-label="Riziko vlastníctva 43 zo 100"');
  });

  it("never presents a demo as researched", () => {
    expect(text(render(score(), false))).toContain("Ukážková analýza");
    expect(text(render(score(), true))).toContain("Živá analýza");
  });

  it("explains thin evidence without calling the answer unreliable", () => {
    // A low-confidence verdict is still a verdict; the panel must say what the
    // estimate stands on, never that there is not enough to go on.
    const thin = text(render(score({ confidence: 20, verdict: "caution" })));

    expect(thin).toContain("kvalifikovaný");
    for (const phrase of ["nedostatok inform", "nízka spoľahlivosť", "neznáme"]) {
      expect(thin.toLowerCase()).not.toContain(phrase);
    }
  });

  it("leaves out a price it does not have rather than printing a zero", () => {
    const priceless = renderToStaticMarkup(
      <VerdictHero product={{ ...product, estimatedPrice: 0 }} score={score()} live />,
    );

    expect(text(priceless)).not.toContain("0 €");
    expect(text(priceless)).toContain("Práčka");
  });
});
