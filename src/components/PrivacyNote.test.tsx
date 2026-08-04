/**
 * The privacy note.
 *
 * A note that describes what someone meant to build is worse than none,
 * because it is believed. These assertions tie each claim to something the
 * codebase can be checked against, so a change that makes the note untrue
 * breaks a test rather than quietly misleading a reader.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrivacyNote } from "./PrivacyNote";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

const text = renderToStaticMarkup(<PrivacyNote />)
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ");

describe("what the note claims", () => {
  it("is reachable without opening it", () => {
    expect(text).toContain("Ochrana súkromia");
  });

  it("names the browser storage the app actually uses", () => {
    // Both keys are the user's own and both are named in the note.
    expect(read("src", "lib", "history.ts")).toContain("localStorage");
    expect(text).toContain("localStorage");
    expect(text).toContain("Vymazať");
  });

  it("matches the seven-day cache the server really keeps", () => {
    expect(read("netlify", "lib", "store.ts")).toContain("CACHE_TTL_MS = 7 *");
    expect(text).toContain("sedem dní");
  });

  it("describes the rate limiter as the hash it is", () => {
    // The limiter keys on a truncated digest, never on the address itself.
    const store = read("netlify", "lib", "store.ts");
    expect(store).toMatch(/createHash\("sha256"\)\.update\(ip\)/);
    expect(text).toContain("hash");
    expect(text).toContain("neukladáme");
  });

  it("only claims no third parties while the policy still forbids them", () => {
    // The claim is verifiable because the header enforces it.
    const csp = read("netlify.toml");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(text).toContain("tretích strán");
  });

  it("says who actually performs the research", () => {
    // Naming the processor is the part a reader cannot discover for themselves.
    expect(text).toContain("Anthropic");
  });
});
