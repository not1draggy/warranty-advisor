// Live product repair-risk search via Anthropic API + web search.
// If ANTHROPIC_API_KEY is not set, returns 501 and the frontend
// silently falls back to demo data. Deploy works either way.

export const config = { path: "/api/search" };

const AUTHORITY_TABLE = `
Source authority scoring (points):
- Authorized/official service center: 95
- Official service manual / OEM documentation: 90
- Large repair shop with a public price list: 80
- Specialized repair forum: 40
- Reddit / general forums: 30
Use ONLY these labels in "authorityLabel" (in Slovak):
"Autorizovaný servis" (95), "Servisný manuál" (90),
"Servis s cenníkom" (80), "Fórum" (40), "Reddit" (30).`;

const SYSTEM_PROMPT = `You are a repair-risk analyst for an e-commerce extended-warranty tool.
Given a product query, identify the exact product and research REAL repair
pricing and common failure points using web search. Prices in EUR, focused
on the Slovak/Czech/EU market where possible.

${AUTHORITY_TABLE}

STRICT RULES:
1. Every price and probability MUST come from a web page you actually
   found via search. Include the real URL in sources. Never invent URLs.
2. If you cannot find real data for a component, EXCLUDE it rather than
   guessing. If you find almost nothing for the whole product, return
   {"error": "insufficient_data"}.
3. Confidence per failure (0-100): base it on source authority, freshness,
   and whether the source matches the exact model. Multiple agreeing
   authoritative sources => 75-90. Single forum mention => 30-45.
   Never exceed 90.
4. probability is the estimated % chance of that failure over ~5 years of
   use. If sources give no basis for a number, use a conservative range
   midpoint and cap confidence at 40.
5. All user-facing strings (category, component names, authorityLabel)
   in SLOVAK.

Respond with ONLY a JSON object (no markdown fences, no prose) matching:
{
  "id": string, "brand": string, "model": string, "category": string,
  "releaseYear": number, "specs": string[],
  "extendedWarrantyPrice": number,
  "warrantyTiers": [{"years": number, "price": number}],
  "avgRepairRange": [number, number],
  "mostCommonFailure": string,
  "failures": [{
    "component": string,
    "riskLevel": "high"|"medium"|"low",
    "probability": number,
    "priceBreakdown": {"part": number, "labor": number, "diagnostics": number, "transport": number},
    "totalRange": [number, number],
    "confidence": number,
    "sources": [{"name": string, "url": string, "date": "YYYY-MM-DD",
                 "authorityLabel": string, "authorityPoints": number}]
  }],
  "riskyComponents": string[],
  "saferComponents": string[]
}
For warrantyTiers, estimate typical Slovak e-shop extended warranty pricing
for the category (1/2/3 years) — mark these are estimates by keeping them
round numbers.`;

function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isValidProduct(p: any): boolean {
  return (
    p &&
    typeof p.brand === "string" &&
    typeof p.model === "string" &&
    Array.isArray(p.failures) &&
    p.failures.length > 0 &&
    p.failures.every(
      (f: any) =>
        typeof f.component === "string" &&
        typeof f.confidence === "number" &&
        Array.isArray(f.sources) &&
        f.sources.length > 0 &&
        f.sources.every((s: any) => typeof s.url === "string" && s.url.startsWith("http")),
    )
  );
}

function clampConfidence(p: any) {
  for (const f of p.failures) {
    f.confidence = Math.max(0, Math.min(90, Math.round(f.confidence)));
    f.probability = Math.max(0, Math.min(95, Math.round(f.probability)));
  }
  return p;
}

export default async (req: Request): Promise<Response> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "live_search_disabled" },
      { status: 501, headers: { "cache-control": "no-store" } },
    );
  }

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 3 || q.length > 120) {
    return Response.json({ error: "invalid_query" }, { status: 400 });
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Product query: ${q}` }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, detail.slice(0, 500));
      return Response.json({ error: "upstream_error" }, { status: 502 });
    }

    const data = (await anthropicRes.json()) as { content: Array<{ type: string; text?: string }> };
    const text = data.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n");

    const parsed = extractJson(text) as any;
    if (!parsed || parsed.error || !isValidProduct(parsed)) {
      return Response.json({ error: "insufficient_data" }, { status: 404 });
    }

    return Response.json(
      { product: clampConfidence(parsed) },
      { headers: { "cache-control": "public, max-age=86400, s-maxage=604800" } },
    );
  } catch (err) {
    console.error(err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
};
