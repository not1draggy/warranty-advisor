import type { VerdictKind } from "../../shared/scoring";

/**
 * Colour per verdict, shared by the hero and the sticky summary.
 * `stroke` is a raw CSS colour so it can be mixed into a surface or fed to SVG.
 */
export const VERDICT_TONE: Record<VerdictKind, { text: string; stroke: string }> = {
  buy: { text: "text-good", stroke: "var(--good)" },
  caution: { text: "text-warn", stroke: "var(--warn)" },
  avoid: { text: "text-bad", stroke: "var(--bad)" },
};
