/**
 * Matching a query against the demo catalogue.
 *
 * Demo mode is what every visitor sees until a key is configured, so this is
 * the product's first impression. The failure that matters is not missing a
 * match — it is returning an analysis of something the reader never asked
 * about, which looks like an answer and is not one.
 */

import { describe, expect, it } from "vitest";
import { findDemoAnalysis } from "./demoAnalyses";

const model = (query: string) => findDemoAnalysis(query)?.product.model ?? null;

describe("finding a demo analysis", () => {
  it("matches the model however it is written", () => {
    for (const query of [
      "Bosch WAN28160BY",
      "bosch wan28160by",
      "WAN28160BY",
      "  Bosch   WAN28160BY  ",
      "bosch wan28160by práčka",
    ]) {
      expect(model(query), query).toBe("WAN28160BY");
    }
  });

  it("accepts a partial model number specific enough to mean one product", () => {
    expect(model("Samsung UE75")).toBe("UE75NU8000");
    expect(model("NU8000")).toBe("UE75NU8000");
  });

  it("returns nothing for a brand on its own", () => {
    // "Bosch" once returned a particular washing machine. A reader asking
    // about a brand has not asked about that machine.
    expect(model("Bosch")).toBeNull();
    expect(model("Samsung")).toBeNull();
    expect(model("Apple")).toBeNull();
  });

  it("returns nothing for a fragment too short to identify anything", () => {
    expect(model("13")).toBeNull();
    expect(model("75")).toBeNull();
  });

  it("returns nothing rather than the closest thing it has", () => {
    expect(model("Whirlpool FWG71484W")).toBeNull();
    expect(model("Neznáma značka XYZ999")).toBeNull();
    expect(model("")).toBeNull();
    expect(model("   ")).toBeNull();
  });

  it("keeps the three catalogue entries reachable by their own names", () => {
    expect(model("iPhone 13")).toBe("iPhone 13");
    expect(model("Samsung UE75NU8000")).toBe("UE75NU8000");
    expect(model("Bosch WAN28160BY")).toBe("WAN28160BY");
  });
});
