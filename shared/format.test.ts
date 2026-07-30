import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BASIS,
  DEAL,
  PARTS_AVAILABILITY,
  PRICE_SOURCE,
  REPAIR_DIFFICULTY,
  RISK_LEVEL,
  VERDICT,
  WARRANTY_WORTH,
  confidenceExplanation,
  eur,
  eurRange,
  formatSourceDate,
  onsetLabel,
  years,
} from "./format";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Wordings the interface must never show. Uncertainty is always described as
 * what an estimate rests on, never as an absence of an answer.
 */
const BANNED = [
  "nedostatok inform",
  "nedostatok údajov",
  "nedostatok dát",
  "nízka spoľahlivosť",
  "vysoká spoľahlivosť",
  "neznám",
  "nenašli sa",
  "nenašlo sa",
  "žiadne údaje",
  "žiadne dáta",
  "not enough information",
  "low confidence",
  "high confidence",
  "no data found",
];

/**
 * Removes comments so that documentation *about* the banned wordings — such as
 * the note at the top of `format.ts` — is not mistaken for user-visible copy.
 * Only whole-line and block comments are stripped, leaving URLs inside strings
 * intact.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

/** Every module that renders text to the user. */
function userFacingFiles(): string[] {
  const componentsDir = join(ROOT, "src", "components");
  return [
    join(ROOT, "shared", "format.ts"),
    join(ROOT, "src", "data", "demoAnalyses.ts"),
    ...readdirSync(componentsDir)
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => join(componentsDir, name)),
  ];
}

describe("user-facing language", () => {
  it("never tells the user that information is missing", () => {
    const offences: string[] = [];

    for (const file of userFacingFiles()) {
      const content = stripComments(readFileSync(file, "utf8")).toLowerCase();
      for (const phrase of BANNED) {
        if (content.includes(phrase)) offences.push(`${file}: "${phrase}"`);
      }
    }

    expect(offences).toEqual([]);
  });

  it("never quotes a probability over a window its onset year contradicts", () => {
    // probability spans the product's life; onsetYears says when. A card
    // claiming "do 5 rokov" beside "Typicky v 7. až 10. roku" is nonsense.
    for (const file of userFacingFiles()) {
      const content = stripComments(readFileSync(file, "utf8"));
      expect(content, file).not.toMatch(/pravdepodobnos.{0,30}5 rokov/i);
    }
  });

  it("explains thin evidence without calling the estimate unreliable", () => {
    const text = confidenceExplanation(20).toLowerCase();
    expect(text).toContain("kvalifikovaný");
    for (const phrase of BANNED) expect(text).not.toContain(phrase);
  });

  it("offers exactly the three permitted recommendations", () => {
    expect(Object.values(VERDICT).map((verdict) => verdict.label)).toEqual([
      "Odporúčame kúpu",
      "Odporúčame kúpu s výhradami",
      "Neodporúčame kúpu",
    ]);
  });

  it("labels every rating the model can return", () => {
    for (const dictionary of [
      RISK_LEVEL,
      PARTS_AVAILABILITY,
      REPAIR_DIFFICULTY,
      WARRANTY_WORTH,
      DEAL,
      PRICE_SOURCE,
    ]) {
      for (const value of Object.values(dictionary)) {
        expect(typeof value === "string" ? value : value.label).toBeTruthy();
      }
    }
  });

  it("always says which price a calculation rests on", () => {
    // A total quoted without saying whose price it used is the assumption the
    // whole rating hangs on, left unstated.
    expect(PRICE_SOURCE.offered).not.toBe(PRICE_SOURCE.market);
    expect(PRICE_SOURCE.market).toContain("odhad");
  });

  it("distinguishes facts, estimates and expert judgement", () => {
    expect(BASIS.fact.label).not.toBe(BASIS.estimate.label);
    expect(BASIS.estimate.label).not.toBe(BASIS.assumption.label);
  });
});

describe("number and date formatting", () => {
  it("writes whole euro amounts without decimals", () => {
    expect(eur(250)).toBe("250 €");
  });

  it("keeps decimals when the amount has them", () => {
    expect(eur(70.9)).toContain("70,9");
  });

  it("collapses a range whose ends are equal", () => {
    expect(eurRange([120, 120])).toBe("120 €");
  });

  it("renders a range with a single currency symbol", () => {
    expect(eurRange([180, 250])).toBe("180 – 250 €");
  });

  it("uses the Slovak plural forms", () => {
    expect(years(1)).toBe("1 rok");
    expect(years(3)).toBe("3 roky");
    expect(years(5)).toBe("5 rokov");
  });

  it("states when a failure typically arrives", () => {
    expect(onsetLabel([7, 10])).toBe("Typicky v 7. až 10. roku");
    expect(onsetLabel([4, 4])).toBe("Typicky okolo 4. roku");
  });

  it("calls out infant mortality in plain words", () => {
    expect(onsetLabel([0, 1])).toBe("Objavuje sa už v prvom roku");
  });

  it("says nothing about timing for damage that has none", () => {
    expect(onsetLabel(null)).toBeNull();
  });

  it("describes an undated source in words rather than leaving a gap", () => {
    expect(formatSourceDate(null)).toBe("bez uvedeného dátumu");
    expect(formatSourceDate("not-a-date")).toBe("bez uvedeného dátumu");
  });

  it("formats a month-only date", () => {
    expect(formatSourceDate("2026-02")).toContain("2026");
  });
});
