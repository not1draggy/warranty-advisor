import { describe, expect, it } from "vitest";
import { parseQuery } from "./query";

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
