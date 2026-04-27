import * as yahooFinanceModule from "yahoo-finance2";

// Robustly resolve default export — Vercel's Node runtime may nest it under .default
// or expose it directly depending on how the ESM/CJS interop resolves.
const yfRaw: any = yahooFinanceModule as any;
const yahooFinance: any = yfRaw.default ?? yfRaw;

// Suppress yahoo-finance2 schema-validation notices in serverless logs
try { yahooFinance.suppressNotices?.(["yahooSurvey"]); } catch {}

// In-memory caches (per serverless instance)
const quoteCache = new Map<string, { data: any; ts: number }>();
const QUOTE_TTL = 15_000;
const searchCacheMap = new Map<string, { data: any; ts: number }>();
const SEARCH_TTL = 300_000;
const chartCacheMap = new Map<string, { data: any; ts: number }>();
const CHART_TTL = 60_000;

export function mapQuote(q: any) {
  return {
    symbol: q.symbol || "",
    name: q.shortName || q.longName || q.symbol || "",
    price: q.regularMarketPrice ?? 0,
    change: q.regularMarketChange ?? 0,
    changesPercentage: q.regularMarketChangePercent ?? 0,
    volume: q.regularMarketVolume ?? 0,
    marketCap: q.marketCap ?? 0,
    pe: q.trailingPE ?? null,
    dayHigh: q.regularMarketDayHigh ?? 0,
    dayLow: q.regularMarketDayLow ?? 0,
    open: q.regularMarketOpen ?? 0,
    previousClose: q.regularMarketPreviousClose ?? 0,
    yearHigh: q.fiftyTwoWeekHigh ?? 0,
    yearLow: q.fiftyTwoWeekLow ?? 0,
    eps: q.epsTrailingTwelveMonths ?? null,
    avgVolume: q.averageDailyVolume3Month ?? q.averageDailyVolume10Day ?? 0,
    sector: q.sector || inferSector(q.symbol || ""),
    exchange: q.fullExchangeName || q.exchange || "",
    quoteType: q.quoteType || "EQUITY",
  };
}

function inferSector(symbol: string): string {
  const sectorMap: Record<string, string> = {
    AAPL: "Technology", MSFT: "Technology", GOOGL: "Technology", META: "Technology", NVDA: "Technology",
    AMZN: "Consumer Cyclical", TSLA: "Consumer Cyclical", JPM: "Financial Services",
    V: "Financial Services", MA: "Financial Services", UNH: "Healthcare", JNJ: "Healthcare",
    PFE: "Healthcare", XOM: "Energy", CVX: "Energy",
  };
  return sectorMap[symbol] || "";
}

function getStartDate(range: string): Date {
  const now = new Date();
  switch (range) {
    case "1d": now.setDate(now.getDate() - 1); break;
    case "5d": now.setDate(now.getDate() - 5); break;
    case "1mo": now.setMonth(now.getMonth() - 1); break;
    case "3mo": now.setMonth(now.getMonth() - 3); break;
    case "6mo": now.setMonth(now.getMonth() - 6); break;
    case "1y": now.setFullYear(now.getFullYear() - 1); break;
    case "2y": now.setFullYear(now.getFullYear() - 2); break;
    case "5y": now.setFullYear(now.getFullYear() - 5); break;
    default: now.setMonth(now.getMonth() - 6); break;
  }
  return now;
}

export async function fetchQuotes(symbols: string[]) {
  const results: any[] = [];
  const toFetch: string[] = [];

  for (const sym of symbols) {
    const cached = quoteCache.get(sym);
    if (cached && Date.now() - cached.ts < QUOTE_TTL) {
      results.push(cached.data);
    } else {
      toFetch.push(sym);
    }
  }

  if (toFetch.length > 0) {
    const fetched = await Promise.allSettled(
      toFetch.map(async (sym) => yahooFinance.quote(sym))
    );
    for (let i = 0; i < toFetch.length; i++) {
      const result = fetched[i];
      if (result.status === "fulfilled" && result.value) {
        const mapped = mapQuote(result.value);
        quoteCache.set(toFetch[i], { data: mapped, ts: Date.now() });
        results.push(mapped);
      } else if (result.status === "rejected") {
        console.warn("Quote rejected for", toFetch[i], result.reason?.message || result.reason);
      }
    }
  }

  const resultMap = new Map(results.map((r) => [r.symbol, r]));
  return symbols.map((s) => resultMap.get(s)).filter(Boolean);
}

export async function searchStocks(query: string) {
  const cacheKey = query.toLowerCase();
  const cached = searchCacheMap.get(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_TTL) return cached.data;

  const result = await yahooFinance.search(query, { newsCount: 0 });
  const mapped = (result.quotes || [])
    .filter((r: any) => ["EQUITY", "ETF", "INDEX", "MUTUALFUND"].includes(r.quoteType))
    .slice(0, 12)
    .map((r: any) => ({
      symbol: r.symbol,
      name: r.shortname || r.longname || r.symbol,
      type: r.quoteType,
      exchange: r.exchDisp || r.exchange,
    }));

  searchCacheMap.set(cacheKey, { data: mapped, ts: Date.now() });
  return mapped;
}

export async function fetchChart(symbol: string, range = "6mo", interval = "1d") {
  const cacheKey = `${symbol}:${range}:${interval}`;
  const cached = chartCacheMap.get(cacheKey);
  if (cached && Date.now() - cached.ts < CHART_TTL) return cached.data;

  const result = await yahooFinance.chart(symbol, {
    period1: getStartDate(range),
    interval: interval as any,
  });

  const bars = (result.quotes || [])
    .map((bar: any) => ({
      date: bar.date ? new Date(bar.date).toISOString().split("T")[0] : "",
      open: bar.open != null ? +bar.open.toFixed(2) : null,
      high: bar.high != null ? +bar.high.toFixed(2) : null,
      low: bar.low != null ? +bar.low.toFixed(2) : null,
      close: bar.close != null ? +bar.close.toFixed(2) : null,
      volume: bar.volume || 0,
    }))
    .filter((b: any) => b.close != null);

  chartCacheMap.set(cacheKey, { data: bars, ts: Date.now() });
  return bars;
}
