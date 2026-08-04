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
  /** Identifies the request that started this run; see `claimJob`. */
  claimedBy?: string;
}

const ANALYSES_STORE = "analyses";
const RATE_LIMIT_STORE = "rate-limits";

/** How long a finished analysis is reused before it is researched again. */
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * A job still pending after this is assumed dead and may be restarted.
 *
 * Must stay comfortably above both the longest realistic research run and the
 * client's own patience. If it expires while a worker is still going, a retry
 * looks like a fresh query and dispatches a second worker — paying twice for
 * the same analysis. Background functions get fifteen minutes, so this sits
 * well inside that while leaving a slow run room to finish.
 */
export const JOB_TIMEOUT_MS = 10 * 60 * 1000;
/**
 * Failures live only long enough for the polling client to collect the
 * outcome. A cached failure that outlived that would keep answering for a
 * product nobody has actually re-examined.
 */
export const FAILURE_TTL_MS = 2 * 60 * 1000;


export function jobId(query: string): string {
  return createHash("sha256").update(normalizeQuery(query)).digest("hex").slice(0, 24);
}

export async function readJob(id: string): Promise<Job | null> {
  // Strong consistency is not optional here. Blobs reads are eventually
  // consistent by default, so a job written a second ago can read back as
  // missing — and the client polls within two and a half seconds of creating
  // it. Every analysis then looked like it had vanished.
  const job = (await getStore(ANALYSES_STORE).get(id, {
    type: "json",
    consistency: "strong",
  })) as Job | null;
  if (!job) return null;

  const age = Date.now() - job.createdAt;
  if (job.status === "ready" && age > CACHE_TTL_MS) return null;
  // A pending job whose worker died would otherwise block the query forever.
  if (job.status === "pending" && age > JOB_TIMEOUT_MS) return null;
  if (job.status === "failed" && age > FAILURE_TTL_MS) return null;

  return job;
}

export async function writeJob(job: Job): Promise<void> {
  await getStore(ANALYSES_STORE).setJSON(job.id, job);
}

/**
 * Claims a new job, returning whether this request won the right to research.
 *
 * A shared link can land several people on the same product at once, and each
 * duplicate is a paid research run. Blobs offers no compare-and-set, so this
 * writes and then reads back with strong consistency: when requests race, they
 * converge on the last write and only its owner dispatches a worker.
 *
 * That narrows the window rather than closing it. Losing the race costs one
 * extra run, which is why a cheap mitigation beats an elaborate lock here.
 */
export async function claimJob(job: Job): Promise<boolean> {
  await writeJob(job);

  let stored: Job | null = null;
  try {
    stored = (await getStore(ANALYSES_STORE).get(job.id, {
      type: "json",
      consistency: "strong",
    })) as Job | null;
  } catch {
    // Unreadable is not the same as taken; see below.
    return true;
  }

  // A read that comes back empty or unclaimed says nothing about a rival — it
  // says the storage has not caught up. Assuming defeat there means no worker
  // is ever dispatched and the analysis silently never happens, which is far
  // worse than the duplicate run this check exists to avoid.
  if (!stored?.claimedBy) return true;

  return stored.claimedBy === job.claimedBy;
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

const BUDGET_STORE = "budget";

/**
 * How many fresh research runs the site will pay for in a day.
 *
 * The per-IP limiter bounds one visitor; it does nothing about a thousand of
 * them, and every run costs a metered model call with web search. A public,
 * unauthenticated endpoint without a ceiling is an open tab on someone's card.
 * Override with `DAILY_RESEARCH_LIMIT`.
 */
export const DEFAULT_DAILY_RESEARCH_LIMIT = 200;

export function dailyResearchLimit(): number {
  const configured = Number.parseInt(process.env.DAILY_RESEARCH_LIMIT ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_DAILY_RESEARCH_LIMIT;
}

/**
 * Claims one run against today's budget.
 *
 * Counts only runs that are actually paid for — a cache hit never reaches
 * here. Like the per-IP limiter this rides on eventually consistent storage, so
 * a burst can overshoot slightly; it exists to stop a runaway bill, not to
 * meter to the unit.
 *
 * Fails open. Losing Blobs must not take the product down, and the spend it
 * guards against is sustained, so the next request will still catch it.
 */
export async function allowResearch(now: Date = new Date()): Promise<boolean> {
  const limit = dailyResearchLimit();
  const key = now.toISOString().slice(0, 10);

  try {
    const store = getStore(BUDGET_STORE);
    const spent = ((await store.get(key, { type: "json" })) as number | null) ?? 0;
    if (spent >= limit) {
      log("daily_budget_exhausted", { day: key, spent, limit });
      return false;
    }
    await store.setJSON(key, spent + 1);
    return true;
  } catch {
    return true;
  }
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
