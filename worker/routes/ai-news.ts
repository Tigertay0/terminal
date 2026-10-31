import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Hono } from "hono";
import * as z from "zod/v4";
import type { AppEnv } from "../app";

/**
 * AI-written headlines and article bodies for the simulation, from Claude
 * Haiku 5.5 (the cheapest Claude model). Signed-in users only (requireUser
 * runs first), limited per user by the NEWS_LIMITER binding, and same-origin
 * only: no CORS headers, so other sites cannot spend the API key.
 */

const MODEL = "claude-haiku-5-5";
const REQUEST_TIMEOUT_MS = 25_000;

// Limits on request input: every call spends API credits, so keep prompts small.
const MAX_STOCKS = 10;
const MAX_ITEM_IDS = 50;
const MAX_FIELD_LENGTH = 100;
const MAX_HEADLINE_LENGTH = 300;

// The game already presents this news as simulated, so the text itself reads
// like ordinary market news.
const SYSTEM_PROMPT =
  "You write short financial news items for a stock-market simulation game. The events are invented for the game. " +
  "Write them in the plain style of real market headlines and articles, without words like \"fictional\" or \"simulated\".";

interface StockInput {
  symbol: string;
  name: string;
  price: number;
  sector: string;
  marketCap: number;
}

const HeadlinesSchema = z.object({
  items: z.array(
    z.object({
      companyName: z.string(),
      companyId: z.string(),
      sector: z.string(),
      headline: z.string(),
      importance: z.enum(["high", "low"]),
      sentiment: z.enum(["bullish", "bearish", "neutral", "alert"]),
      expectedGrowth: z.number(),
    }),
  ),
});

const DetailsSchema = z.object({
  items: z.array(z.object({ headline: z.string(), summary: z.string() })),
});

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").slice(0, maxLength);
}

function parseStocks(raw: unknown): StockInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_STOCKS).flatMap((s: any) => {
    const price = Number(s?.price);
    const symbol = cleanText(s?.symbol, 15).trim().toUpperCase();
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

function formatMarketCap(mc: number): string {
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc.toLocaleString()}`;
}

function headlinesPrompt(stocks: StockInput[], variation: string): string {
  const stockList = stocks
    .map((s) => `- ${s.symbol} (${s.name}): $${s.price.toFixed(2)}, sector=${s.sector || "Unknown"}, marketCap=${formatMarketCap(s.marketCap)}`)
    .join("\n");
  const market =
    variation === "high"
      ? "high volatility (dramatic swings, more breaking news)"
      : variation === "low"
        ? "low volatility (calm markets, mostly routine news)"
        : "realistic volatility (normal market conditions)";
  const count = Math.min(stocks.length * 2, 10);

  return `Write ${count} news headlines about these stocks.

STOCKS:
${stockList}

Market: ${market}.
For each item: companyName, companyId (the ticker exactly as listed), sector, a specific (not generic) headline, importance ("high" for about 30% of items, otherwise "low"), sentiment ("alert" for urgent breaking news), and expectedGrowth as a percent: large caps ±1-5, mid caps ±3-10, small caps ±5-25.
expectedGrowth must match the sentiment: negative for bearish or bad-news alerts, positive for bullish.
Mix positive and negative news realistically. In high volatility, include frequent sharp drops (-10 to -25).`;
}

function detailsPrompt(headlines: string[]): string {
  return `Write a 3-4 sentence article body for each of these headlines, in the same order. Repeat each headline in "headline" and put the body in "summary".

${headlines.map((h) => `- ${h}`).join("\n")}`;
}

export const newsRoutes = new Hono<AppEnv>();

newsRoutes.post("/", async (c) => {
  const { success } = await c.env.NEWS_LIMITER.limit({ key: c.var.user.id });
  if (!success) {
    return c.json({ error: "Too many news requests. Try again in a few minutes." }, 429);
  }

  const apiKey = c.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not configured");
    return c.json({ error: "News service not configured" }, 500);
  }

  const body = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const stocks = parseStocks(body.stocks);
  const variation = String(body.variation ?? "");
  const detailed = body.mode === "detailed";
  // Detailed mode: the headlines that need full articles.
  const headlines = Array.isArray(body.itemIds)
    ? body.itemIds.slice(0, MAX_ITEM_IDS).map((id) => cleanText(id, MAX_HEADLINE_LENGTH))
    : [];
  if (!stocks.length) return c.json({ error: "No stocks provided" }, 400);
  if (detailed && !headlines.length) return c.json({ error: "No headlines provided" }, 400);

  const client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  c.header("Cache-Control", "no-store");

  try {
    if (detailed) {
      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 8000,
        output_config: { effort: "low", format: zodOutputFormat(DetailsSchema) },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: detailsPrompt(headlines) }],
      });
      if (!response.parsed_output) {
        console.error("AI news details unusable, stop_reason:", response.stop_reason);
        return c.json({ error: "News could not be generated" }, 502);
      }
      return c.json(response.parsed_output.items);
    }

    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(HeadlinesSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: headlinesPrompt(stocks, variation) }],
    });
    if (!response.parsed_output) {
      console.error("AI headlines unusable, stop_reason:", response.stop_reason);
      return c.json({ error: "News could not be generated" }, 502);
    }

    // Only stocks that were asked about; summaries load on demand in detailed mode.
    const asked = new Set(stocks.map((s) => s.symbol));
    const items = response.parsed_output.items
      .map((item) => ({ ...item, companyId: item.companyId.toUpperCase(), summary: "" }))
      .filter((item) => asked.has(item.companyId) && item.headline && Number.isFinite(item.expectedGrowth));
    return c.json(items);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.warn("Anthropic rate limit hit");
      return c.json({ error: "News service is busy. Try again shortly." }, 503);
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
      return c.json({ error: "News provider error" }, 502);
    }
    throw error;
  }
});
