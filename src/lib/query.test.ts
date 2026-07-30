import { describe, expect, it } from "vitest";
import { parseQuery } from "./query";

describe("parseQuery", () => {
  it("treats a bare model as the product", () => {
    expect(parseQuery("Bosch WAN28160BY")).toEqual({
      product: "Bosch WAN28160BY",
      warrantyYears: null,
      warrantyPrice: null,
    });
  });

  it("reads warranty length and price out of the query", () => {
    expect(parseQuery("Bosch WAN28160BY +3 70,90€")).toEqual({
      product: "Bosch WAN28160BY",
      warrantyYears: 3,
      warrantyPrice: 70.9,
    });
  });

  it("accepts a warranty length with no price", () => {
    expect(parseQuery("iPhone 13 +2")).toMatchObject({
      product: "iPhone 13",
      warrantyYears: 2,
      warrantyPrice: null,
    });
  });

  it("accepts the Slovak word forms and a decimal point", () => {
    expect(parseQuery("Samsung QE55 +2 roky 149.50 €")).toMatchObject({
      product: "Samsung QE55",
      warrantyYears: 2,
      warrantyPrice: 149.5,
    });
  });

  it("leaves a model number that merely contains a plus sign alone", () => {
    expect(parseQuery("Bosch WAN+28160")).toMatchObject({
      product: "Bosch WAN+28160",
      warrantyYears: null,
    });
  });

  it("ignores an implausible warranty length", () => {
    expect(parseQuery("TV +99")).toMatchObject({ product: "TV +99", warrantyYears: null });
  });

  it("normalises surrounding whitespace", () => {
    expect(parseQuery("  Bosch   WAN28160BY  ").product).toBe("Bosch WAN28160BY");
  });

  it("reports an empty product for an empty query", () => {
    expect(parseQuery("   ").product).toBe("");
  });
});
