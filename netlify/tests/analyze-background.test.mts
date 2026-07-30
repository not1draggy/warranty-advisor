/**
 * Tests for the research worker.
 *
 * Lives outside `netlify/functions/` for the same reason as the endpoint
 * tests: Netlify deploys everything in that directory as a function.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "../lib/store";

const store = vi.hoisted(() => ({
  readJob: vi.fn(),
  writeJob: vi.fn(),
  log: vi.fn(),
}));

const model = vi.hoisted(() => ({
  streamed: vi.fn(),
  finalMessage: vi.fn(),
}));

vi.mock("../lib/store", () => store);

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      stream: (params: unknown) => {
        model.streamed(params);
        return { finalMessage: model.finalMessage };
      },
    };
  },
}));

const { default: worker } = await import("../functions/analyze-background.mjs");

const pendingJob: Job = {
  id: "job-1",
  query: "Bosch WAN28160BY",
  status: "pending",
  createdAt: Date.now(),
};

/** A payload complete enough to survive normalisation. */
const evidencePayload = {
  isProduct: true,
  product: {
    brand: "Bosch",
    model: "WAN28160BY",
    category: "Práčka",
    releaseYear: 2020,
    specs: [],
    matchLevel: "exact",
    estimatedPrice: 430,
    priceBasis: "estimate",
  },
  evidenceNote: "Zistené zo servisných cenníkov.",
  failures: [
    {
      component: "Ložiská bubna",
      description: "Hluk pri odstreďovaní.",
      riskLevel: "high",
      probability: 26,
      frequency: "Po siedmich rokoch.",
      onsetYears: [7, 10],
      repairCost: [180, 250],
      basis: "estimate",
      difficulty: "high",
      sourceIds: [],
    },
  ],
  worstCase: { component: "Ložiská bubna", cost: [180, 250], note: "" },
  partsAvailability: { rating: "good", note: "Dostupné." },
  repairDifficulty: { rating: "medium", note: "Stredné." },
  strengths: ["Tichý chod"],
  weaknesses: ["Malá kapacita"],
  serviceExperience: "Spoľahlivá.",
  ownerExperience: "Bez problémov.",
  competitors: [],
  goodFor: ["Menšie domácnosti"],
  notGoodFor: ["Veľké rodiny"],
  summary: "Dobrá voľba.",
  sources: [],
};

const reply = (text: string, stopReason = "end_turn") => ({
  stop_reason: stopReason,
  content: [{ type: "text", text }],
  usage: { output_tokens: 1234 },
});

const dispatch = (body: unknown = { id: "job-1" }) =>
  worker(
    new Request("https://example.com/.netlify/functions/analyze-background", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
  store.readJob.mockResolvedValue(pendingJob);
  store.writeJob.mockResolvedValue(undefined);
  model.finalMessage.mockResolvedValue(reply(JSON.stringify(evidencePayload)));
});

describe("dispatch guard", () => {
  it("rejects a request with no job id", async () => {
    expect((await dispatch({})).status).toBe(400);
    expect(model.streamed).not.toHaveBeenCalled();
  });

  it("refuses to research a job that does not exist", async () => {
    store.readJob.mockResolvedValue(null);

    expect((await dispatch()).status).toBe(409);
    // This is what stops a direct hit on the endpoint spending money.
    expect(model.streamed).not.toHaveBeenCalled();
  });

  it("refuses to research a job that already finished", async () => {
    store.readJob.mockResolvedValue({ ...pendingJob, status: "ready" });

    expect((await dispatch()).status).toBe(409);
    expect(model.streamed).not.toHaveBeenCalled();
  });
});

describe("research request", () => {
  it("asks for web search and a schema-constrained answer", async () => {
    await dispatch();

    const params = model.streamed.mock.calls[0][0];
    expect(params.tools[0]).toMatchObject({ name: "web_search" });
    expect(params.output_config.format).toMatchObject({ type: "json_schema" });
    expect(params.output_config.effort).toBe("high");
    expect(params.messages[0].content).toContain("Bosch WAN28160BY");
  });
});

describe("outcomes", () => {
  it("stores the evidence when research succeeds", async () => {
    await dispatch();

    expect(store.writeJob).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ready",
        evidence: expect.objectContaining({
          product: expect.objectContaining({ model: "WAN28160BY" }),
        }),
      }),
    );
  });

  it("normalises the payload rather than storing it raw", async () => {
    const exaggerated = structuredClone(evidencePayload);
    exaggerated.failures[0].probability = 400;
    model.finalMessage.mockResolvedValue(reply(JSON.stringify(exaggerated)));

    await dispatch();

    const stored = store.writeJob.mock.calls[0][0];
    expect(stored.evidence.failures[0].probability).toBe(95);
  });

  it("says the query names no product rather than inventing a verdict", async () => {
    model.finalMessage.mockResolvedValue(
      reply(JSON.stringify({ ...evidencePayload, isProduct: false })),
    );

    await dispatch();

    expect(store.writeJob).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", reason: "not_a_product" }),
    );
  });

  it("still analyses a product known only at category level", async () => {
    const thin = structuredClone(evidencePayload);
    thin.product.matchLevel = "category";
    model.finalMessage.mockResolvedValue(reply(JSON.stringify(thin)));

    await dispatch();

    // Thin evidence about a real product is never a not-a-product outcome.
    expect(store.writeJob).toHaveBeenCalledWith(expect.objectContaining({ status: "ready" }));
  });

  it("records a refusal instead of writing an empty analysis", async () => {
    model.finalMessage.mockResolvedValue(reply("", "refusal"));

    await dispatch();

    expect(store.writeJob).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", reason: "refused" }),
    );
  });

  it("records a failure when the answer cannot be parsed", async () => {
    model.finalMessage.mockResolvedValue(reply("Ospravedlňujem sa, nepomôžem."));

    await dispatch();

    expect(store.writeJob).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", reason: "unusable_response" }),
    );
  });

  it("records a failure when the answer describes no failure modes", async () => {
    model.finalMessage.mockResolvedValue(
      reply(JSON.stringify({ ...evidencePayload, failures: [] })),
    );

    await dispatch();

    expect(store.writeJob).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", reason: "unusable_response" }),
    );
  });

  it("records a failure when the upstream call throws", async () => {
    model.finalMessage.mockRejectedValue(new Error("upstream exploded"));

    await dispatch();

    expect(store.writeJob).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", reason: "upstream_error" }),
    );
  });

  it("always leaves the job in a terminal state the client can act on", async () => {
    model.finalMessage.mockRejectedValue(new Error("upstream exploded"));

    await dispatch();

    // A job left pending would have the client polling something nobody runs.
    expect(store.writeJob.mock.calls.every(([job]) => job.status !== "pending")).toBe(true);
  });
});
