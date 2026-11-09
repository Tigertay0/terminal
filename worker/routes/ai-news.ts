import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app";

/**
 * AI-written headlines and article bodies for the simulation, from Claude
 * Haiku 5.5 (the cheapest Claude model). Signed-in users only (requireUser
 * runs first), limited per user and overall by rate-limit bindings, and
 * same-origin only: no CORS headers, so other sites cannot spend the API key.
 */

const MODEL = "claude-haiku-5-5";
const REQUEST_TIMEOUT_MS = 25_000;

// Limits on request input: every call spends API credits, so keep prompts small.
const MAX_STOCKS = 10;
const MAX_DETAIL_ITEMS = 10;
const MAX_FIELD_LENGTH = 60;
const MAX_HEADLINE_LENGTH = 300;
// Limits on what is sent back, whatever the model writes.
const MAX_HEADLINE_OUTPUT = 200;
const MAX_SUMMARY_OUTPUT = 1500;
// Hard daily ceilings (UTC days), on top of the per-minute rate limits. At
// Haiku 5.5 prices a call costs well under a cent, so these keep a bad day
// to a few dollars.
const MAX_CALLS_PER_USER_PER_DAY = 150;
const MAX_CALLS_PER_DAY = 3000;
// Matches the sharpest moves the prompt asks for; anything beyond is a model slip.
const MAX_GROWTH_PERCENT = 25;

// The game already presents this news as simulated, so the text itself reads
// like ordinary market news, but it never invents wrongdoing by real people.
const SYSTEM_PROMPT =
  "You write short financial news items for a stock-market simulation game. The events are invented for the game. " +
  "Write them in the plain style of real market headlines and articles, without words like \"fictional\" or \"simulated\". " +
  "Do not name real people, and do not invent crimes, fraud, lawsuits or regulatory actions.";

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
      companyId: z.string(),
      headline: z.string(),
      importance: z.enum(["high", "low"]),
      sentiment: z.enum(["bullish", "bearish", "neutral", "alert"]),
      expectedGrowth: z.number(),
    }),
  ),
});

const DetailsSchema = z.object({
  items: z.array(z.object({ index: z.number().int(), summary: z.string() })),
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

function headlinesPrompt(stocks: StockInput[], variation: string, count: number): string {
  const stockList = stocks
    .map((s) => `- ${s.symbol} (${s.name}): $${s.price.toFixed(2)}, sector=${s.sector || "Unknown"}, marketCap=${formatMarketCap(s.marketCap)}`)
    .join("\n");
  const market =
    variation === "high"
      ? "high volatility (dramatic swings, more breaking news)"
      : variation === "low"
        ? "low volatility (calm markets, mostly routine news)"
        : "realistic volatility (normal market conditions)";

  return `Write ${count} news headlines about these stocks.

STOCKS:
${stockList}

Market: ${market}.
For each item: companyId (the ticker exactly as listed), a specific (not generic) headline, importance ("high" for about 30% of items, otherwise "low"), sentiment ("alert" for urgent breaking news), and expectedGrowth as a percent: large caps ±1-5, mid caps ±3-10, small caps ±5-25.
expectedGrowth must match the sentiment: negative for bearish or bad-news alerts, positive for bullish.
Mix positive and negative news realistically. In high volatility, include frequent sharp drops (-10 to -25).`;
}

function detailsPrompt(headlines: string[]): string {
  return `Write a 3-4 sentence article body for each headline below. Return one item per headline, with its number as "index" and the body as "summary".

${headlines.map((h, i) => `${i}. ${h}`).join("\n")}`;
}

/** Keeps the model's price impact within the game's range and on the side its sentiment says. */
export function settleGrowth(sentiment: string, growth: number): number {
  const size = Math.min(Math.abs(growth), MAX_GROWTH_PERCENT);
  if (sentiment === "bullish") return size;
  if (sentiment === "bearish") return -size;
  return Math.sign(growth) * size;
}

/**
 * One structured-output call. Returns null, after logging why, when the reply
 * is unusable (refused, cut off, or not the requested shape): the client shows
 * its built-in news instead, and retrying the same input would only be billed again.
 */
async function generate<T>(
  c: Context<AppEnv>,
  client: Anthropic,
  schema: z.ZodType<T>,
  prompt: string,
  maxTokens: number,
): Promise<T | null> {
  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: maxTokens,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    },
    // A closed tab stops the call instead of paying for an answer nobody reads.
    { signal: c.req.raw.signal },
  );
  if (response.stop_reason !== "end_turn") {
    console.error("AI news unusable, stop_reason:", response.stop_reason);
    return null;
  }
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    console.error("AI news was not JSON:", (error as Error).message, "-", text.slice(0, 500));
    return null;
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error("AI news did not match the schema:", result.error.message, "-", text.slice(0, 500));
    return null;
  }
  return result.data;
}

/** Counts this call against today's allowances; false when either is used up. */
async function withinDailyQuota(c: Context<AppEnv>): Promise<boolean> {
  const { rows } = await c.var.pool.query<{ user_calls: number; all_calls: number }>(
    `WITH mine AS (
       INSERT INTO ai_news_usage (user_id, day, calls) VALUES ($1, current_date, 1)
       ON CONFLICT (user_id, day) DO UPDATE SET calls = ai_news_usage.calls + 1
       RETURNING calls
     ), everyone AS (
       INSERT INTO ai_news_daily (day, calls) VALUES (current_date, 1)
       ON CONFLICT (day) DO UPDATE SET calls = ai_news_daily.calls + 1
       RETURNING calls
     )
     SELECT (SELECT calls FROM mine) AS user_calls, (SELECT calls FROM everyone) AS all_calls`,
    [c.var.user.id],
  );
  const usage = rows[0];
  return Boolean(usage && usage.user_calls <= MAX_CALLS_PER_USER_PER_DAY && usage.all_calls <= MAX_CALLS_PER_DAY);
}

export const newsRoutes = new Hono<AppEnv>();

newsRoutes.post("/", async (c) => {
  c.header("Cache-Control", "no-store");

  const body = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const stocks = parseStocks(body.stocks);
  const variation = String(body.variation ?? "");
  const detailed = body.mode === "detailed";
  // Detailed mode: the headlines that need full articles.
  const headlines = Array.isArray(body.itemIds)
    ? body.itemIds.slice(0, MAX_DETAIL_ITEMS).map((id) => cleanText(id, MAX_HEADLINE_LENGTH))
    : [];
  if (!stocks.length) return c.json({ error: "No stocks provided" }, 400);
  if (detailed && !headlines.length) return c.json({ error: "No headlines provided" }, 400);

  const apiKey = c.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not configured");
    return c.json({ error: "News service not configured" }, 500);
  }

  // Per user first, then a ceiling for everyone, so one busy account cannot
  // use up the shared allowance.
  const perUser = await c.env.NEWS_LIMITER.limit({ key: c.var.user.id });
  const overall = perUser.success ? await c.env.NEWS_GLOBAL_LIMITER.limit({ key: "all" }) : perUser;
  if (!perUser.success || !overall.success) {
    c.header("Retry-After", "60");
    return c.json({ error: "Too many news requests. Try again in a few minutes." }, 429);
  }
  if (!(await withinDailyQuota(c))) {
    return c.json({ error: "AI news is done for today. Built-in news keeps the game going." }, 429);
  }

  // No SDK retries: the client already retries the cases worth retrying.
  const client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });

  try {
    if (detailed) {
      const result = await generate(c, client, DetailsSchema, detailsPrompt(headlines), 400 * headlines.length + 800);
      if (!result) return c.json({ error: "News could not be generated" }, 502);
      // In the order asked for, so the client can match bodies to headlines by position.
      const byIndex = new Map(result.items.map((item) => [item.index, item.summary.slice(0, MAX_SUMMARY_OUTPUT)]));
      return c.json(headlines.map((headline, i) => ({ headline, summary: byIndex.get(i) ?? "" })));
    }

    const count = Math.min(stocks.length * 2, 10);
    const result = await generate(c, client, HeadlinesSchema, headlinesPrompt(stocks, variation, count), 2500);
    if (!result) return c.json({ error: "News could not be generated" }, 502);

    // Company details come from the request, not the model; summaries load on demand.
    const asked = new Map(stocks.map((s) => [s.symbol, s]));
    const items = result.items.flatMap((item) => {
      const stock = asked.get(item.companyId.toUpperCase());
      if (!stock || !item.headline || !Number.isFinite(item.expectedGrowth)) return [];
      return [{
        companyName: stock.name || stock.symbol,
        companyId: stock.symbol,
        sector: stock.sector || "Unknown",
        headline: item.headline.slice(0, MAX_HEADLINE_OUTPUT),
        summary: "",
        importance: item.importance,
        sentiment: item.sentiment,
        expectedGrowth: settleGrowth(item.sentiment, item.expectedGrowth),
      }];
    });
    return c.json(items.slice(0, count));
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      console.warn("Anthropic rate limit hit");
      c.header("Retry-After", "60");
      return c.json({ error: "News service is busy. Try again shortly." }, 503);
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      console.warn("Anthropic call timed out");
      return c.json({ error: "News took too long" }, 504);
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
      return c.json({ error: "News provider error" }, 502);
    }
    throw error;
  }
});
