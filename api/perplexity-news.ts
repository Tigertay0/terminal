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

    const prompt = `You are a financial news generator for a stock market simulation game.

Generate realistic, specific financial news for the following stocks. The market is in ${modeDesc} mode.

STOCKS:
${stockList}

RULES:
1. Generate exactly ${Math.min(stocks.length, 8)} news items total.
2. Every company must get at least 1 news item. Larger companies can get 2-3.
3. Mix of positive and negative news (roughly 55% positive, 30% negative, 15% neutral-framed).
4. Each item MUST have importance = "high" or "low". About 30% should be "high".
5. Each item MUST have expectedGrowth as a percentage number (e.g. 4.5 or -2.1).
6. CRITICAL CALIBRATION for expectedGrowth:
   - Large-cap stocks (>$100/share): major events = +1% to +5%, minor = +0.1% to +0.8%
   - Mid-cap stocks ($20-$100): major events = +3% to +10%
   - Small-cap/penny stocks (<$20): major events = +5% to +25%, minor = +0.5% to +3%
   - Same ranges apply in the NEGATIVE direction for bad news.
7. Headlines must be SPECIFIC and informative (NOT generic like "Company reports results").
   GOOD: "NovaTech Q3 revenue beats estimates by 18% on cloud segment growth"
   BAD: "NovaTech reports quarterly results"
8. Each item needs a detailed 4-5 sentence in-depth news article body explaining the news context, financial impact, and implications. Put this in the "summary" field.
9. No duplicate or contradictory headlines for the same company.
10. News must have logical causal connection to the expectedGrowth value.

Return ONLY a JSON array (no markdown, no explanation) with this exact structure:
[
  {
    "companyName": "Company Name",
    "companyId": "TICKER",
    "sector": "Sector",
    "headline": "Specific headline here",
    "summary": "Detailed 4-5 sentence in-depth article body here...",
    "importance": "high" or "low",
    "expectedGrowth": 4.5
  }
]`;

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
        max_tokens: 4096,
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
