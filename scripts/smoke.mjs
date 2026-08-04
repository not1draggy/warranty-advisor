#!/usr/bin/env node
/**
 * Runs one real analysis against a deployed site and reports what happened.
 *
 * Every unit test passed while production was completely broken: a job was
 * written and read back as missing, and nothing exercised that seam because
 * nothing ran against a real deployment. This does, in one command, and prints
 * enough to tell a slow run from a dead one.
 *
 *   npm run smoke -- https://example.netlify.app
 *   npm run smoke -- https://example.netlify.app "Bosch WAN28160BY"
 *
 * Exit code 0 means an analysis actually came back.
 */

const [baseArg, queryArg] = process.argv.slice(2);

if (!baseArg) {
  console.error("usage: npm run smoke -- <base-url> [query]");
  process.exit(2);
}

const base = baseArg.replace(/\/+$/, "");
const query = queryArg ?? "Bosch WAN28160BY";
const POLL_INTERVAL_MS = 5_000;
/** Generous on purpose: a slow answer is still an answer. */
const GIVE_UP_MS = 12 * 60 * 1000;

const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;
const say = (message) => console.log(`[${elapsed().padStart(4)}] ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Never throws: a failed request is a result worth reporting, not a crash. */
async function request(path, init) {
  try {
    const response = await fetch(`${base}${path}`, init);
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      // Left null — an HTML body usually means a redirect ate the API route.
    }
    return { status: response.status, body, text };
  } catch (error) {
    return { status: 0, body: null, text: String(error) };
  }
}

async function checkHealth() {
  const { status, body, text } = await request("/api/v1/health");

  if (status === 0) {
    say(`health: unreachable — ${text}`);
    return false;
  }
  if (!body) {
    say(`health: HTTP ${status} but the body is not JSON`);
    say("  the API route is probably being swallowed by the SPA redirect");
    return false;
  }

  say(`health: HTTP ${status} — ${body.detail ?? ""}`);
  for (const [name, ok] of Object.entries(body.checks ?? {})) {
    say(`  ${ok ? "ok  " : "FAIL"} ${name}`);
  }
  return body.ready === true;
}

async function analyse() {
  say(`asking for: ${query}`);
  const created = await request("/api/v1/analyses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (created.status === 503) {
    say("live analysis is switched off (no API key) — the site serves demos only");
    return false;
  }
  if (!created.body?.id) {
    say(`could not start: HTTP ${created.status} ${created.text.slice(0, 200)}`);
    return false;
  }

  const { id } = created.body;
  say(`job ${id} accepted (HTTP ${created.status}), polling…`);

  let missing = 0;
  const deadline = Date.now() + GIVE_UP_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const polled = await request(`/api/v1/analyses/${id}`);

    if (polled.status === 404) {
      missing += 1;
      // The exact symptom of the outage: written, then invisible.
      say(`not found yet (${missing}) — job written but not readable back`);
      continue;
    }
    if (polled.status !== 200 || !polled.body) {
      say(`poll failed: HTTP ${polled.status} ${polled.text.slice(0, 200)}`);
      return false;
    }

    const job = polled.body;
    if (job.status === "pending") {
      say("still researching…");
      continue;
    }
    if (job.status === "failed") {
      say(`analysis failed: ${job.reason}`);
      return false;
    }

    const { product, failures = [], sources = [] } = job.evidence ?? {};
    say(`DONE in ${elapsed()}`);
    say(`  ${product?.brand ?? ""} ${product?.model ?? "?"} — ${product?.category ?? "?"}`);
    say(`  match: ${product?.matchLevel}, price: ${product?.estimatedPrice} EUR`);
    say(`  service life: ${product?.serviceLifeYears} years`);
    say(`  ${failures.length} failure modes, ${sources.length} sources`);
    for (const failure of failures) {
      say(`    - ${failure.component}: ${failure.probability}% · ${failure.repairCost?.join("–")} EUR`);
    }
    return true;
  }

  say(`gave up after ${elapsed()} — the job never finished`);
  return false;
}

say(`target: ${base}`);
const ready = await checkHealth();

if (!ready) {
  say("not ready for live research — fix the failing checks above first");
  process.exit(1);
}

process.exit((await analyse()) ? 0 : 1);
