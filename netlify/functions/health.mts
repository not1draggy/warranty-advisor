/**
 * Deployment diagnostics: GET /api/v1/health
 *
 * Live research needs three things that are configured outside this repo — an
 * API key, Netlify Blobs, and background functions. When any is missing the
 * app quietly falls back to demo analyses, which looks like working software.
 * This reports each one so a deployment can be checked in one request rather
 * than inferred from behaviour.
 *
 * Booleans only. It never reveals the key, only whether one is present.
 */

import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { allowRequest, clientIp, log, readJob, writeJob } from "../lib/store";

export const config: Config = { path: "/api/v1/health" };

const PROBE_STORE = "health";
const PROBE_KEY = "probe";
/** Distinctive enough that it can never collide with a real query's hash. */
const PROBE_JOB_ID = "__health_probe__";

/**
 * Each check costs one background-function invocation, which is metered. A
 * human clicking to see whether a deploy came up needs a handful; anything
 * beyond that is someone spending the site's quota for free.
 */
const RATE_LIMIT = { windowMs: 60_000, max: 6 };

/**
 * Round-trips a real job through the real code path.
 *
 * Deliberately not a private probe store: the fault that took the product down
 * was a job written and then read back as missing a moment later, because the
 * read was eventually consistent. Only exercising `writeJob` and `readJob`
 * themselves can catch that, so this writes a probe job and reads it straight
 * back exactly as a polling browser would.
 */
async function storageWorks(): Promise<boolean> {
  try {
    const store = getStore(PROBE_STORE);
    const stamp = Date.now();
    await store.setJSON(PROBE_KEY, { stamp });
    const read = (await store.get(PROBE_KEY, { type: "json" })) as { stamp?: number } | null;
    if (read?.stamp !== stamp) return false;

    await writeJob({
      id: PROBE_JOB_ID,
      query: "health probe",
      status: "pending",
      createdAt: Date.now(),
    });
    return (await readJob(PROBE_JOB_ID))?.id === PROBE_JOB_ID;
  } catch {
    return false;
  }
}

/**
 * Pokes the worker with a body it will reject. Background functions are a plan
 * feature, so this proves the endpoint is actually deployed — and the missing
 * job id means it returns 400 immediately without any model call to pay for.
 */
async function workerWorks(request: Request): Promise<boolean> {
  try {
    const worker = new URL("/.netlify/functions/analyze-background", request.url);
    const response = await fetch(worker, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    // 404 means it was never deployed; anything else means it answered.
    return response.status !== 404;
  } catch {
    return false;
  }
}

/**
 * Fails open: the limiter writes to Blobs, and Blobs being down is one of the
 * things this endpoint exists to report. Refusing to answer then would hide
 * exactly the fault the caller came to find.
 */
async function withinLimit(request: Request): Promise<boolean> {
  try {
    return await allowRequest(clientIp(request), RATE_LIMIT);
  } catch {
    return true;
  }
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  if (!(await withinLimit(request))) {
    return Response.json(
      { error: "rate_limited", detail: "Kontrola sa dá spustiť najviac niekoľkokrát za minútu." },
      { status: 429, headers: { "cache-control": "no-store" } },
    );
  }

  const [storage, worker] = await Promise.all([storageWorks(), workerWorks(request)]);
  const analysisKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const ready = analysisKey && storage && worker;

  log("health_checked", { analysisKey, storage, worker, ready });

  return Response.json(
    {
      ready,
      checks: {
        analysisKey,
        storage,
        worker,
      },
      // Spelled out, because "not ready" on its own sends people to the logs.
      detail: ready
        ? "Živá analýza je pripravená."
        : [
            analysisKey ? null : "Chýba premenná ANTHROPIC_API_KEY.",
            storage
              ? null
              : "Úložisko úloh nefunguje — analýza sa spustí, ale výsledok sa nedá načítať.",
            worker ? null : "Funkcia na pozadí (background function) nie je nasadená.",
          ]
            .filter(Boolean)
            .join(" "),
    },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
};
