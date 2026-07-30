/**
 * Persistence for analysis jobs, backed by Netlify Blobs.
 *
 * Research runs take far longer than a synchronous function may, so requests
 * create a job and poll it. The same store doubles as the response cache: a
 * finished analysis is served straight from the blob until it expires.
 */

import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import type { AnalysisEvidence } from "../../shared/analysis";
import { normalizeQuery } from "../../shared/text";

export type JobStatus = "pending" | "ready" | "failed";

export interface Job {
  id: string;
  query: string;
  status: JobStatus;
  createdAt: number;
  evidence?: AnalysisEvidence;
  /** Machine-readable failure cause; the UI maps it to Slovak. */
  reason?: string;
}

const ANALYSES_STORE = "analyses";
const RATE_LIMIT_STORE = "rate-limits";

/** How long a finished analysis is reused before it is researched again. */
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A job still pending after this is assumed dead and may be restarted. */
export const JOB_TIMEOUT_MS = 4 * 60 * 1000;


export function jobId(query: string): string {
  return createHash("sha256").update(normalizeQuery(query)).digest("hex").slice(0, 24);
}

export async function readJob(id: string): Promise<Job | null> {
  const job = (await getStore(ANALYSES_STORE).get(id, { type: "json" })) as Job | null;
  if (!job) return null;

  const age = Date.now() - job.createdAt;
  if (job.status === "ready" && age > CACHE_TTL_MS) return null;
  // A pending job whose worker died would otherwise block the query forever.
  if (job.status === "pending" && age > JOB_TIMEOUT_MS) return null;

  return job;
}

export async function writeJob(job: Job): Promise<void> {
  await getStore(ANALYSES_STORE).setJSON(job.id, job);
}

export interface RateLimit {
  windowMs: number;
  max: number;
}

/**
 * Fixed-window limiter keyed by client IP.
 *
 * Blobs are eventually consistent, so a burst of simultaneous requests can
 * slip through — this bounds sustained abuse of the paid research call, which
 * is what it exists for.
 */
export async function allowRequest(ip: string, limit: RateLimit): Promise<boolean> {
  const store = getStore(RATE_LIMIT_STORE);
  const window = Math.floor(Date.now() / limit.windowMs);
  const key = `${createHash("sha256").update(ip).digest("hex").slice(0, 16)}:${window}`;

  const count = ((await store.get(key, { type: "json" })) as number | null) ?? 0;
  if (count >= limit.max) return false;

  await store.setJSON(key, count + 1);
  return true;
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Structured log line; never include the API key or full model output. */
export function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ...fields }));
}
