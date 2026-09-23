import type { VercelRequest, VercelResponse } from "@vercel/node";

// Limits on request input: every call spends Perplexity credits, so keep prompts small.
const MAX_STOCKS = 10;
const MAX_ITEM_IDS = 50;
const MAX_FIELD_LENGTH = 100;
const MAX_HEADLINE_LENGTH = 300;

interface StockInput {
  symbol: string;
  name: string;
  price: number;
  sector: string;
  marketCap: number;
}

interface AINewsItem {
  companyName: string;
  companyId: string;
  sector: string;
  headline: string;
  summary: string;
  importance: "high" | "low";
  sentiment: "bullish" | "bearish" | "neutral" | "alert";
  expectedGrowth: number;
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").slice(0, maxLength);
}

function parseStocks(raw: unknown): StockInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_STOCKS).flatMap((s: any) => {
    const price = Number(s?.price);
    const symbol = cleanText(s?.symbol, 15).trim();
    if (!symbol || !Number.isFinite(price)) return [];
    return [{
      symbol,
      name: cleanText(s?.name, MAX_FIELD_LENGTH),
      price,
      sector: cleanText(s?.sector, MAX_FIELD_LENGTH),
      marketCap: Number(s?.marketCap) || 0,
    }];
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Same-origin only: no CORS headers, so other sites cannot spend the API key.
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.error("PERPLEXITY_API_KEY not configured");
    return res.status(500).json({ error: "News service not configured" });
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const stocks = parseStocks(body.stocks);
    const variation = String(body.variation ?? "");
    const fetchMode = body.mode === "detailed" ? "detailed" : "headlines";
    // for detailed mode: which items need full articles
    const itemIds = Array.isArray(body.itemIds)
      ? body.itemIds.slice(0, MAX_ITEM_IDS).map((id) => cleanText(id, MAX_HEADLINE_LENGTH))
      : [];

    if (!stocks.length) {
      return res.status(400).json({ error: "No stocks provided" });
    }

    // Build stock summary for the prompt
    const stockList = stocks
      .map(
        (s) =>
          `- ${s.symbol} (${s.name}): $${s.price.toFixed(2)}, sector=${s.sector || "Unknown"}, marketCap=${formatMarketCap(s.marketCap)}`
      )
      .join("\n");

    // Determine tier descriptions for growth calibration
    const modeDesc =
      variation === "high"
        ? "high volatility (dramatic swings, more breaking news)"
        : variation === "low"
          ? "low volatility (calm markets, mostly routine news)"
          : "realistic volatility (normal market conditions)";

    const numItems = Math.min(stocks.length * 2, 10);

    let prompt: string;
    if (fetchMode === "detailed") {
      // Detailed mode: generate full article bodies for provided headlines
      const headlineList = itemIds.join("; ");
      prompt = `Write detailed 3-4 sentence news article bodies for these financial headlines. Return JSON array with headline and summary fields only.

Headlines: ${headlineList}

Return ONLY JSON array: [{"headline":"...","summary":"detailed 3-4 sentence article body..."}]`;
    } else {
      // Headlines mode: fast, compact, no summaries needed
      prompt = `Generate ${numItems} financial news headlines as JSON for a stock sim.

STOCKS: ${stockList}

Market: ${modeDesc}. Each: companyName, companyId (TICKER), sector, headline (specific not generic), importance ("high"/"low", ~30% high), sentiment ("bullish"/"bearish"/"neutral"/"alert"), expectedGrowth (% number: large-cap ±1-5%, mid-cap ±3-10%, small-cap ±5-25%). Use "alert" for urgent breaking news.
CRITICAL: If sentiment is bearish or alert-negative, expectedGrowth MUST be a negative number (e.g. -5.2)! If bullish, it MUST be positive!
Ensure a realistic mix of positive and negative news. In high volatility, include frequent sharp negative drops (-10% to -25%).
Return ONLY JSON array:
[{"companyName":"...","companyId":"TICKER","sector":"...","headline":"...","importance":"high","sentiment":"bullish","expectedGrowth":4.5}]`;
    }

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You are a financial news generation AI. Output ONLY valid JSON arrays. No markdown code fences, no explanation text.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: fetchMode === "detailed" ? 2048 : 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Perplexity API error:", response.status, errText.slice(0, 500));
      return res.status(502).json({ error: `News provider returned ${response.status}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    // Parse JSON — handle possible markdown code fences
    let parsed: AINewsItem[];
    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
      const json = JSON.parse(cleaned);
      if (!Array.isArray(json)) throw new Error("AI response is not a JSON array");
      parsed = json;
    } catch (parseErr: any) {
      console.error("Failed to parse Perplexity response:", parseErr?.message, content.slice(0, 500));
      return res.status(502).json({ error: "Failed to parse AI response as JSON" });
    }

    // For detailed mode, return the raw parsed summaries (they only have headline + summary)
    if (fetchMode === "detailed") {
      const detailResults = parsed.map((item: any) => ({
        headline: String(item.headline || ""),
        summary: String(item.summary || item.body || item.article || ""),
      }));
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(detailResults);
    }

    // Validate and sanitize (headlines mode)
    const validated: AINewsItem[] = parsed
      .filter(
        (item: any) =>
          item &&
          item.companyId &&
          item.headline &&
          typeof item.expectedGrowth === "number"
      )
      .map((item: any, idx: number) => ({
        companyName: String(item.companyName || item.companyId),
        companyId: String(item.companyId).toUpperCase(),
        sector: String(item.sector || "Unknown"),
        headline: String(item.headline),
        summary: String(item.summary || ""),
        importance: item.importance === "high" ? "high" : "low",
        sentiment: ["bullish", "bearish", "neutral", "alert"].includes(item.sentiment)
          ? item.sentiment
          : item.expectedGrowth > 0 ? "bullish" : item.expectedGrowth < 0 ? "bearish" : "neutral",
        expectedGrowth: Number(item.expectedGrowth) || 0,
      }));

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(validated);
  } catch (err: any) {
    console.error("Perplexity news error:", err?.message || err);
    return res.status(500).json({ error: "Failed to generate news" });
  }
}

function formatMarketCap(mc: number): string {
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc.toLocaleString()}`;
}
