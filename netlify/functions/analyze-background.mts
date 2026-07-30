/**
 * Background worker that researches one product and stores the evidence.
 *
 * Only runs for a job the API already created and left pending, so hitting
 * this endpoint directly cannot start paid research on its own.
 */

import Anthropic from "@anthropic-ai/sdk";
import { normalizeEvidence } from "../../shared/normalize";
import { ANALYSIS_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from "../lib/prompt";
import { log, readJob, writeJob } from "../lib/store";

const MODEL = "claude-opus-5";
/** Generous: the cap covers thinking, web search and the JSON answer together. */
const MAX_TOKENS = 32_000;
const MAX_SEARCHES = 6;

/**
 * Dynamic-filtering web search. The installed SDK's `ToolUnion` still only
 * knows the older `web_search_20250305`, so the definition is passed through
 * as-is; the model accepts it and filters results before they reach context.
 */
const WEB_SEARCH_TOOL = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: MAX_SEARCHES,
} as unknown as Anthropic.ToolUnion;

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Structured output should be pure JSON; salvage it if anything wraps it.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

async function research(query: string) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(query) }],
    tools: [WEB_SEARCH_TOOL],
    output_config: {
      // Reliability judgement is the product; this runs off the request path,
      // so buy quality with latency rather than the other way round.
      effort: "high",
      format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
    },
  });

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") return { refused: true as const };

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return { refused: false as const, parsed: extractJson(text), usage: message.usage };
}

export default async (request: Request): Promise<Response> => {
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return new Response(null, { status: 400 });

  const job = await readJob(id);
  if (!job || job.status !== "pending") return new Response(null, { status: 409 });

  const startedAt = Date.now();
  try {
    const result = await research(job.query);

    if (result.refused) {
      log("analysis_refused", { id });
      await writeJob({ ...job, status: "failed", reason: "refused" });
      return new Response(null, { status: 200 });
    }

    const evidence = normalizeEvidence(result.parsed, job.query);
    if (!evidence) {
      log("analysis_unusable", { id, ms: Date.now() - startedAt });
      await writeJob({ ...job, status: "failed", reason: "unusable_response" });
      return new Response(null, { status: 200 });
    }

    log("analysis_ready", {
      id,
      ms: Date.now() - startedAt,
      failures: evidence.failures.length,
      sources: evidence.sources.length,
      matchLevel: evidence.product.matchLevel,
      outputTokens: result.usage.output_tokens,
    });
    await writeJob({ ...job, status: "ready", evidence });
  } catch (error) {
    log("analysis_error", {
      id,
      ms: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "unknown",
    });
    await writeJob({ ...job, status: "failed", reason: "upstream_error" });
  }

  return new Response(null, { status: 200 });
};
