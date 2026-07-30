/**
 * Deciding what to show once the research comes back.
 *
 * These branches were the only real logic in the app with no test around them,
 * and the one that matters most is the quietest: a comparison where one
 * candidate failed must not be presented as a comparison, because a table with
 * a single column reads as a verdict against whatever is missing.
 */

import { describe, expect, it } from "vitest";
import type { AnalysisEvidence } from "../../shared/analysis";
import type { AnalysisOutcome, FailureReason } from "./api";
import { resolveOutcomes } from "./outcome";
import { parseComparison } from "./query";

const evidence = (model: string) =>
  ({ product: { model, brand: "Značka" } }) as unknown as AnalysisEvidence;

const ready = (model: string, live = true): AnalysisOutcome => ({
  status: "ready",
  evidence: evidence(model),
  live,
});

const failed = (reason: FailureReason): AnalysisOutcome => ({ status: "failed", reason });

describe("a single product", () => {
  it("shows its analysis", () => {
    const parts = parseComparison("Bosch WAN28160BY");
    const resolved = resolveOutcomes(parts, [ready("WAN28160BY")]);

    expect(resolved).toMatchObject({ kind: "ready", live: true });
  });

  it("shows the failure when it did not come back", () => {
    const parts = parseComparison("Bosch WAN28160BY");

    expect(resolveOutcomes(parts, [failed("not_a_product")])).toEqual({
      kind: "failed",
      reason: "not_a_product",
    });
  });
});

describe("a comparison", () => {
  const parts = () => parseComparison("Bosch WAN28160BY 349€ vs Samsung WW70");

  it("compares when both came back", () => {
    const resolved = resolveOutcomes(parts(), [ready("WAN28160BY"), ready("WW70")]);

    expect(resolved.kind).toBe("compared");
    if (resolved.kind !== "compared") return;
    expect(resolved.candidates).toHaveLength(2);
    // Each candidate keeps the terms typed for it, not the first one's.
    expect(resolved.candidates[0].offeredPrice).toBe(349);
    expect(resolved.candidates[1].offeredPrice).toBeNull();
  });

  it("falls back to a plain analysis when only one came back", () => {
    // A table with a single column reads as a verdict against whatever is
    // missing — a product that was never assessed at all.
    const resolved = resolveOutcomes(parts(), [ready("WAN28160BY"), failed("upstream_error")]);

    expect(resolved.kind).toBe("ready");
    if (resolved.kind !== "ready") return;
    expect(resolved.evidence.product.model).toBe("WAN28160BY");
    // And it keeps that candidate's own price, not the other's.
    expect(resolved.query.price).toBe(349);
  });

  it("keeps the survivor's own terms when the first one is the casualty", () => {
    const resolved = resolveOutcomes(parts(), [failed("upstream_error"), ready("WW70")]);

    expect(resolved.kind).toBe("ready");
    if (resolved.kind !== "ready") return;
    expect(resolved.evidence.product.model).toBe("WW70");
    expect(resolved.query.price).toBeNull();
  });

  it("reports a real reason when every candidate failed", () => {
    const resolved = resolveOutcomes(parts(), [failed("rate_limited"), failed("network")]);

    // Not a generic fault: the first real reason is the one to act on.
    expect(resolved).toEqual({ kind: "failed", reason: "rate_limited" });
  });

  it("carries the demo flag per candidate rather than for the set", () => {
    const resolved = resolveOutcomes(parts(), [ready("WAN28160BY", false), ready("WW70", true)]);

    if (resolved.kind !== "compared") throw new Error("expected a comparison");
    expect(resolved.candidates.map((c) => c.live)).toEqual([false, true]);
  });
});

describe("outcomes that do not line up", () => {
  it("does not invent a result when an outcome is missing", () => {
    const parts = parseComparison("Bosch WAN28160BY vs Samsung WW70");

    expect(resolveOutcomes(parts, [ready("WAN28160BY")])).toMatchObject({ kind: "ready" });
  });

  it("fails cleanly on an empty field", () => {
    expect(resolveOutcomes([], [])).toEqual({ kind: "failed", reason: "upstream_error" });
  });
});
