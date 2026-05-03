import type { VercelRequest, VercelResponse } from "@vercel/node";
import { corsHeaders } from "./_lib/cors.js";

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
  expectedGrowth: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "PERPLEXITY_API_KEY not configured" });
  }

  try {
    const { stocks, variation } = req.body as {
      stocks: StockInput[];
      variation: string;
    };

    if (!stocks?.length) {
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

    const numItems = Math.min(stocks.length, 5);
    const prompt = `Generate ${numItems} financial news items as JSON array for a stock simulation.

STOCKS: ${stockList}

Market: ${modeDesc}. Each item: companyName, companyId (TICKER), sector, headline (specific, not generic), summary (2-3 sentences), importance ("high"/"low", ~30% high), expectedGrowth (% number: large-cap ±1-5%, mid-cap ±3-10%, small-cap ±5-25%). Mix positive/negative. Return ONLY JSON array:
[{"companyName":"...","companyId":"TICKER","sector":"...","headline":"...","summary":"...","importance":"high","expectedGrowth":4.5}]`;

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
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Perplexity API error:", response.status, errText);
      return res.status(502).json({
        error: `Perplexity API returned ${response.status}`,
        detail: errText.slice(0, 200),
      });
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
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse Perplexity response:", content.slice(0, 500));
      return res.status(502).json({
        error: "Failed to parse AI response as JSON",
        raw: content.slice(0, 300),
      });
    }

    // Validate and sanitize
    const validated: AINewsItem[] = parsed
      .filter(
        (item: any) =>
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
        expectedGrowth: Number(item.expectedGrowth) || 0,
      }));

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(validated);
  } catch (err: any) {
    console.error("Perplexity news error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

function formatMarketCap(mc: number): string {
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc.toLocaleString()}`;
}
