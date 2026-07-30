import { describe, expect, it } from "vitest";
import { extractJson } from "./json";

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("tolerates surrounding whitespace", () => {
    expect(extractJson('\n  {"a":1}\n')).toEqual({ a: 1 });
  });

  it("salvages an object wrapped in prose", () => {
    expect(extractJson('Tu je analýza:\n{"a":1}\nDúfam, že pomôže.')).toEqual({ a: 1 });
  });

  it("salvages an object inside a code fence", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("keeps nested objects intact", () => {
    expect(extractJson('prefix {"a":{"b":[1,2]}} suffix')).toEqual({ a: { b: [1, 2] } });
  });

  it("is not fooled by a brace inside a string value", () => {
    // A naive last-brace scan would swallow the trailing prose here.
    expect(extractJson('{"note":"závorka } v texte"} a ešte niečo')).toEqual({
      note: "závorka } v texte",
    });
  });

  it("handles an escaped quote before a brace", () => {
    expect(extractJson('{"note":"uvádzam \\" a }"}')).toEqual({ note: 'uvádzam " a }' });
  });

  it("returns null for text with no object at all", () => {
    expect(extractJson("Ospravedlňujem sa, nemôžem pomôcť.")).toBeNull();
  });

  it("returns null for an empty response", () => {
    expect(extractJson("")).toBeNull();
    expect(extractJson("   ")).toBeNull();
  });

  it("returns null when the object is truncated", () => {
    expect(extractJson('{"a":1')).toBeNull();
  });

  it("returns null when the enclosed text is not valid JSON", () => {
    expect(extractJson("prefix {not json} suffix")).toBeNull();
  });
});
