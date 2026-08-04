import { describe, expect, it } from "vitest";
import { MAX_COMPARISON, parseComparison, parseQuery } from "./query";

describe("parseQuery", () => {
  it("treats a bare model as the product", () => {
    expect(parseQuery("Bosch WAN28160BY")).toEqual({
      product: "Bosch WAN28160BY",
      price: null,
      warrantyYears: null,
      warrantyPrice: null,
    });
  });

  it("reads warranty length and price out of the query", () => {
    expect(parseQuery("Bosch WAN28160BY +3 70,90€")).toEqual({
      product: "Bosch WAN28160BY",
      price: null,
      warrantyYears: 3,
      warrantyPrice: 70.9,
    });
  });

  it("reads the price the buyer is being offered", () => {
    expect(parseQuery("Bosch WAN28160BY 349€")).toMatchObject({
      product: "Bosch WAN28160BY",
      price: 349,
    });
  });

  it("keeps the offered price and the warranty price apart", () => {
    expect(parseQuery("Bosch WAN28160BY 349€ +3 70,90€")).toEqual({
      product: "Bosch WAN28160BY",
      price: 349,
      warrantyYears: 3,
      warrantyPrice: 70.9,
    });
  });

  it("accepts the spellings people actually type", () => {
    expect(parseQuery("iPhone 13 za 499 EUR").price).toBe(499);
    expect(parseQuery("Samsung QE55 1 299,90 €").price).toBe(1299.9);
    expect(parseQuery("Samsung QE55 1.299€").price).toBe(1299);
  });

  it("never mistakes a model number for a price", () => {
    // Without a currency marker there is no way to tell one from the other,
    // and reading a model number as a price would silently rescore the report.
    expect(parseQuery("Samsung UE75NU8000")).toMatchObject({
      product: "Samsung UE75NU8000",
      price: null,
    });
    expect(parseQuery("iPhone 13 128").price).toBeNull();
  });

  it("ignores a price no shop would ask", () => {
    expect(parseQuery("Bosch WAN28160BY 0€")).toMatchObject({
      product: "Bosch WAN28160BY 0€",
      price: null,
    });
    expect(parseQuery("Bosch WAN28160BY 999999€").price).toBeNull();
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

describe("parseComparison", () => {
  it("treats a single product as a field of one", () => {
    expect(parseComparison("Bosch WAN28160BY").map((p) => p.product)).toEqual(["Bosch WAN28160BY"]);
  });

  it("splits the candidates a buyer is weighing up", () => {
    for (const separator of ["vs", "vs.", "versus", "alebo", "proti"]) {
      expect(
        parseComparison(`Bosch WAN28160BY ${separator} Samsung WW70`).map((p) => p.product),
        separator,
      ).toEqual(["Bosch WAN28160BY", "Samsung WW70"]);
    }
  });

  it("keeps each candidate's own price and warranty", () => {
    // Comparing two offers usually means comparing two different prices.
    expect(parseComparison("Bosch WAN28160BY 349€ vs Samsung WW70 429€ +2 59€")).toEqual([
      { product: "Bosch WAN28160BY", price: 349, warrantyYears: null, warrantyPrice: null },
      { product: "Samsung WW70", price: 429, warrantyYears: 2, warrantyPrice: 59 },
    ]);
  });

  it("never splits a model number that merely contains the letters", () => {
    // "vs" inside a name is not a separator; only a standalone word is.
    expect(parseComparison("Samsung QE55LSVSX").map((p) => p.product)).toEqual(["Samsung QE55LSVSX"]);
    expect(parseComparison("Bosch SMV-25/AX").map((p) => p.product)).toEqual(["Bosch SMV-25/AX"]);
  });

  it("caps the field at a size a person can actually decide between", () => {
    const many = ["A1", "B2", "C3", "D4", "E5"].join(" vs ");
    expect(parseComparison(many)).toHaveLength(MAX_COMPARISON);
  });

  it("drops an empty side rather than comparing against nothing", () => {
    expect(parseComparison("Bosch WAN28160BY vs ").map((p) => p.product)).toEqual([
      "Bosch WAN28160BY",
    ]);
    expect(parseComparison("   ")).toEqual([]);
  });
});
