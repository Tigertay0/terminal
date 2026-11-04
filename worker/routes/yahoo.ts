import { Hono, type Context } from "hono";
import { SYMBOL_PATTERN } from "../../shared/limits";
import type { AppEnv } from "../app";
import { CHART_INTERVALS, CHART_RANGES, fetchChart, fetchNews, fetchQuotes, searchStocks } from "../lib/yahoo";

/** Public, read-only market data from Yahoo Finance. */

const MAX_SYMBOLS = 30;
const MAX_QUERY_LENGTH = 64;
const CACHE_ORIGIN = "https://terminal-cache.internal";

/**
 * Answers from Cloudflare's cache when it can, otherwise computes and stores
 * the JSON for `ttl` seconds. The key is built from the validated input, so
 * reordered or junk query strings share one entry.
 */
async function cachedJson<T>(
  c: Context<AppEnv>,
  key: string,
  ttl: number,
  compute: () => Promise<T>,
  worthCaching: (data: T) => boolean = () => true,
) {
  // Absent outside the Workers runtime (unit tests); a no-op on *.workers.dev,
  // where the per-isolate caches in lib/yahoo.ts do the work.
  const cache = typeof caches === "undefined" ? undefined : caches.default;
  const request = new Request(`${CACHE_ORIGIN}${key}`);
  const hit = await cache?.match(request);
  if (hit) return hit;

  const data = await compute();
  const response = new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${ttl}`,
      "Access-Control-Allow-Origin": "*",
    },
  });
  if (cache && worthCaching(data)) {
    c.executionCtx.waitUntil(
      cache.put(request, response.clone()).catch((error) => console.warn(`[cache] ${(error as Error).message}`)),
    );
  }
  return response;
}

export const yahooRoutes = new Hono<AppEnv>();

yahooRoutes.use("*", async (c, next) => {
  // Per client address: every miss here is a call to Yahoo.
  const address = c.req.header("cf-connecting-ip");
  if (address && !(await c.env.MARKET_LIMITER.limit({ key: address })).success) {
    return c.json({ error: "Too many requests" }, 429, { "Retry-After": "60" });
  }
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
  }
  await next();
  c.header("Access-Control-Allow-Origin", "*");
});

yahooRoutes.get("/quote", async (c) => {
  const symbols = [...new Set(
    (c.req.query("symbols") ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => SYMBOL_PATTERN.test(s)),
  )].slice(0, MAX_SYMBOLS);
  if (symbols.length === 0) return c.json({ error: "No symbols" }, 400);

  try {
    // A partial answer (Yahoo failed some symbols) is served but not cached.
    return await cachedJson(c, `/quote/${symbols.join(",")}`, 10, () => fetchQuotes(symbols), (data) => data.length === symbols.length);
  } catch (err) {
    console.error("Quote error:", (err as Error)?.message || err);
    return c.json({ error: "Failed to fetch quotes" }, 502);
  }
});

yahooRoutes.get("/chart", async (c) => {
  const symbol = (c.req.query("symbol") ?? "").trim().toUpperCase();
  const range = c.req.query("range") ?? "6mo";
  const interval = c.req.query("interval") ?? "1d";
  if (!symbol) return c.json({ error: "No symbol" }, 400);
  if (!SYMBOL_PATTERN.test(symbol)) return c.json({ error: "Invalid symbol" }, 400);
  if (!(CHART_RANGES as readonly string[]).includes(range)) return c.json({ error: "Invalid range" }, 400);
  if (!(CHART_INTERVALS as readonly string[]).includes(interval)) return c.json({ error: "Invalid interval" }, 400);

  try {
    return await cachedJson(c, `/chart/${symbol}/${range}/${interval}`, 60, () => fetchChart(symbol, range, interval));
  } catch (err) {
    console.error("Chart error:", (err as Error)?.message || err);
    return c.json({ error: "Failed to fetch chart data" }, 502);
  }
});

yahooRoutes.get("/news", async (c) => {
  const symbol = (c.req.query("symbol") ?? "").trim().toUpperCase();
  if (!symbol) return c.json({ error: "No symbol" }, 400);
  if (!SYMBOL_PATTERN.test(symbol)) return c.json({ error: "Invalid symbol" }, 400);

  try {
    return await cachedJson(c, `/news/${symbol}`, 120, () => fetchNews(symbol));
  } catch (err) {
    console.error("News error:", (err as Error)?.message || err);
    return c.json({ error: "Failed to fetch news" }, 502);
  }
});

yahooRoutes.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (!q) return c.json([]);

  try {
    return await cachedJson(c, `/search/${encodeURIComponent(q.toLowerCase())}`, 300, () => searchStocks(q));
  } catch (err) {
    console.error("Search error:", (err as Error)?.message || err);
    return c.json({ error: "Search failed" }, 502);
  }
});
