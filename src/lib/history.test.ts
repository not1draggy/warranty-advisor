import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearHistory, readHistory, recordAnalysis } from "./history";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } satisfies Storage;
}

const entry = (query: string, model = query) =>
  ({ query, model, verdict: "caution", risk: 42 }) as const;

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

describe("recordAnalysis", () => {
  it("keeps the most recent analysis first", () => {
    recordAnalysis(entry("Bosch WAN28160BY"));
    recordAnalysis(entry("iPhone 13"));

    expect(readHistory().map((e) => e.model)).toEqual(["iPhone 13", "Bosch WAN28160BY"]);
  });

  it("replaces an earlier look at the same product", () => {
    recordAnalysis(entry("Bosch WAN28160BY"));
    recordAnalysis(entry("iPhone 13"));
    recordAnalysis(entry("  bosch   wan28160by  ", "Bosch WAN28160BY"));

    const models = readHistory().map((e) => e.model);
    expect(models).toEqual(["Bosch WAN28160BY", "iPhone 13"]);
  });

  it("keeps the shortlist short", () => {
    for (let i = 0; i < 10; i += 1) recordAnalysis(entry(`Model ${i}`));
    expect(readHistory()).toHaveLength(6);
  });

  it("preserves the original query so warranty terms survive", () => {
    recordAnalysis(entry("Bosch WAN28160BY +3 70,90€", "WAN28160BY"));
    expect(readHistory()[0].query).toBe("Bosch WAN28160BY +3 70,90€");
  });
});

describe("readHistory", () => {
  it("starts empty", () => {
    expect(readHistory()).toEqual([]);
  });

  it("ignores entries written by an older version or by hand", () => {
    localStorage.setItem(
      "wa-history",
      JSON.stringify([{ query: "x" }, { ...entry("ok"), at: 1 }, "junk"]),
    );
    expect(readHistory().map((e) => e.model)).toEqual(["ok"]);
  });

  it("survives a corrupted store", () => {
    localStorage.setItem("wa-history", "{not json");
    expect(readHistory()).toEqual([]);
  });
});

describe("clearHistory", () => {
  it("empties the list", () => {
    recordAnalysis(entry("Bosch WAN28160BY"));
    clearHistory();
    expect(readHistory()).toEqual([]);
  });
});

describe("without usable storage", () => {
  it("degrades to no history rather than throwing", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });

    expect(() => recordAnalysis(entry("Bosch"))).not.toThrow();
    expect(readHistory()).toEqual([]);
    expect(() => clearHistory()).not.toThrow();
  });
});
