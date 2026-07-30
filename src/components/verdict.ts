import type { VerdictKind } from "../../shared/scoring";

/** Colour treatment per verdict, shared by the hero and the sticky summary. */
export const VERDICT_TONE: Record<
  VerdictKind,
  { text: string; bg: string; stroke: string }
> = {
  buy: { text: "text-good", bg: "bg-good-soft", stroke: "var(--good)" },
  caution: { text: "text-warn", bg: "bg-warn-soft", stroke: "var(--warn)" },
  avoid: { text: "text-bad", bg: "bg-bad-soft", stroke: "var(--bad)" },
};
