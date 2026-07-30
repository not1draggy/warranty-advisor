/**
 * Analysis API.
 *
 *   POST /api/v1/analyses        create or reuse an analysis for a query
 *   GET  /api/v1/analyses/:id    poll a running analysis
 *
 * Research needs far longer than a synchronous function is allowed to run, so
 * this endpoint only owns the job record and hands the work to
 * `analyze-background`, which the client then polls.
 */

import type { Config, Context } from "@netlify/functions";
import {
  allowRequest,
  clientIp,
  jobId,
  log,
  readJob,
  writeJob,
  type Job,
} from "../lib/store";

export const config: Config = {
  path: ["/api/v1/analyses", "/api/v1/analyses/:id"],
};

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 120;
const RATE_LIMIT = { windowMs: 60_000, max: 10 };

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** Public shape of a job — the client never sees internal bookkeeping. */
function present(job: Job) {
  return job.status === "ready"
    ? { id: job.id, status: job.status, evidence: job.evidence, live: true }
    : { id: job.id, status: job.status, reason: job.reason };
}

async function handleGet(id: string) {
  const job = await readJob(id);
  if (!job) return json({ error: "not_found" }, 404);
  return json(present(job));
}

async function handlePost(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "live_analysis_unavailable" }, 503);
  }

  const body = (await request.json().catch(() => null)) as { query?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
    return json({ error: "invalid_query" }, 400);
  }

  const id = jobId(query);
  const existing = await readJob(id);
  if (existing) return json(present(existing));

  if (!(await allowRequest(clientIp(request), RATE_LIMIT))) {
    return json({ error: "rate_limited" }, 429);
  }

  const job: Job = { id, query, status: "pending", createdAt: Date.now() };
  await writeJob(job);

  // Background functions accept the request and return 202 immediately, so
  // awaiting this only covers the handoff, not the research itself.
  const worker = new URL("/.netlify/functions/analyze-background", request.url);
  const handoff = await fetch(worker, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  }).catch(() => null);

  if (!handoff || handoff.status >= 400) {
    log("worker_handoff_failed", { id, status: handoff?.status ?? null });
    await writeJob({ ...job, status: "failed", reason: "worker_unavailable" });
    return json({ id, status: "failed", reason: "worker_unavailable" }, 502);
  }

  log("analysis_started", { id });
  return json({ id, status: "pending" }, 202);
}

export default async (request: Request, context: Context): Promise<Response> => {
  try {
    const id = context.params?.id;
    if (request.method === "GET" && id) return await handleGet(id);
    if (request.method === "POST" && !id) return await handlePost(request);
    return json({ error: "method_not_allowed" }, 405);
  } catch (error) {
    log("api_error", { message: error instanceof Error ? error.message : "unknown" });
    return json({ error: "internal_error" }, 500);
  }
};
