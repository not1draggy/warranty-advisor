/**
 * What the interface says when there is no analysis to show.
 *
 * Every failure the client can produce lands here, and the choice that matters
 * is whether it offers a retry: a button that cannot help is worse than no
 * button, because the user spends their patience on it. TypeScript guarantees
 * a message exists for each reason; it cannot check that the message is any
 * good or that the retry decision is right.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FailureReason } from "../lib/api";
import { StateNotice } from "./StateNotice";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ALL_REASONS: FailureReason[] = [
  "unavailable",
  "rate_limited",
  "daily_limit",
  "worker_unavailable",
  "network",
  "refused",
  "still_running",
  "not_a_product",
  "unusable_response",
  "upstream_error",
];

const render = (reason: FailureReason) =>
  renderToStaticMarkup(<StateNotice reason={reason} onRetry={() => {}} />);

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const offersRetry = (reason: FailureReason) => text(render(reason)).includes("Skúsiť znova");

describe("every state the user can land in", () => {
  it("explains itself rather than showing an empty card", () => {
    for (const reason of ALL_REASONS) {
      const body = text(render(reason));
      // A heading and a sentence of explanation, not a bare code.
      expect(body.length, reason).toBeGreaterThan(60);
      expect(body, reason).not.toContain(reason);
    }
  });

  it("never describes the outcome as missing information", () => {
    // The whole product exists to avoid that answer; a failure state is about
    // what the system did, never about the evidence being thin.
    const banned = ["nedostatok inform", "neznáme", "nenašli sa", "nízka spoľahlivosť"];

    for (const reason of ALL_REASONS) {
      const body = text(render(reason)).toLowerCase();
      for (const phrase of banned) expect(body, `${reason}: ${phrase}`).not.toContain(phrase);
    }
  });
});

describe("whether a retry is offered", () => {
  it("offers one where trying again could plausibly work", () => {
    for (const reason of [
      "still_running",
      "network",
      "upstream_error",
      "worker_unavailable",
    ] as const) {
      expect(offersRetry(reason), reason).toBe(true);
    }
  });

  it("withholds it when the day's budget is what ran out", () => {
    // Retrying cannot succeed until tomorrow. A button here would spend the
    // user's patience on a request that is guaranteed to fail.
    expect(offersRetry("daily_limit")).toBe(false);
    expect(text(render("daily_limit"))).toContain("zajtra");
  });

  it("withholds it when the user has to change what they typed", () => {
    // The search box directly above is the affordance for these.
    expect(offersRetry("not_a_product")).toBe(false);
    expect(offersRetry("refused")).toBe(false);
    expect(offersRetry("unavailable")).toBe(false);
  });

  it("tells a running job apart from a dead one", () => {
    // These two are one word apart in the code and opposite in meaning: one
    // says the work continues, the other that it stopped.
    expect(text(render("still_running"))).toContain("ešte stále beží");
    expect(text(render("upstream_error"))).not.toContain("ešte stále beží");
  });
});

describe("keeping the interface in step with the server", () => {
  /** Every `reason:` the serverless functions actually write down. */
  function reasonsTheServerWrites(): string[] {
    const dir = join(ROOT, "netlify", "functions");
    const found = new Set<string>();

    for (const name of readdirSync(dir)) {
      const source = readFileSync(join(dir, name), "utf8");
      for (const [, reason] of source.matchAll(/reason: "([a-z_]+)"/g)) found.add(reason);
    }
    return [...found].sort();
  }

  it("has Slovak wording for every reason the server can produce", () => {
    // These are two lists in two files. When they drift, the user is shown a
    // generic technical error for something the system knew precisely — which
    // is exactly how "Analýza trvala dlhšie" came to describe a storage fault.
    const unhandled = reasonsTheServerWrites().filter(
      (reason) => !(ALL_REASONS as string[]).includes(reason),
    );

    expect(unhandled).toEqual([]);
  });

  it("carries no wording for a state that can no longer happen", () => {
    // Dead copy outlives the code that produced it and then describes
    // something else entirely.
    const client = readFileSync(join(ROOT, "src", "lib", "api.ts"), "utf8");

    for (const reason of ALL_REASONS) {
      const produced =
        client.includes(`reason: "${reason}"`) ||
        reasonsTheServerWrites().includes(reason) ||
        // Mapped from a job the server stored rather than produced locally.
        client.includes(`"${reason}",`);
      expect(produced, reason).toBe(true);
    }
  });
});
