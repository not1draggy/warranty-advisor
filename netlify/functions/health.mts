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
import { log } from "../lib/store";

export const config: Config = { path: "/api/v1/health" };

const PROBE_STORE = "health";
const PROBE_KEY = "probe";

/** Round-trips a value through Blobs, which backs both the cache and the jobs. */
async function storageWorks(): Promise<boolean> {
  try {
    const store = getStore(PROBE_STORE);
    const stamp = Date.now();
    await store.setJSON(PROBE_KEY, { stamp });
    const read = (await store.get(PROBE_KEY, { type: "json" })) as { stamp?: number } | null;
    return read?.stamp === stamp;
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

export default async (request: Request): Promise<Response> => {
  if (request.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
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
            storage ? null : "Netlify Blobs nie je dostupné pre tento web.",
            worker ? null : "Funkcia na pozadí (background function) nie je nasadená.",
          ]
            .filter(Boolean)
            .join(" "),
    },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
};
