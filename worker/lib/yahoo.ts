import { MemoryCookieStore } from "tough-cookie";
import YahooFinance from "yahoo-finance2";
import { ExtendedCookieJar } from "yahoo-finance2/lib/cookieJar";

// Yahoo's session cookie and crumb are kept for the whole isolate, but each call
// gets its own client. A client's request queue and in-flight crumb lookup are
// promises, and a Worker cancels work that one request leaves to another, so a
// shared client fails whenever two requests overlap.
const cookieStore = new MemoryCookieStore();

function yahooClient(): any {
  return new YahooFinance({ suppressNotices: ["yahooSurvey"], cookieJar: new ExtendedCookieJar(cookieStore) });
}

interface CacheEntry<T> {
  data: T;
  ts: number;
}

// In-memory caches (per Worker isolate), in front of the Cache API in routes/yahoo.ts
const quoteCache = new Map<string, CacheEntry<MappedQuote>>();
const QUOTE_TTL = 15_000;
const searchCacheMap = new Map<string, CacheEntry<MappedSearchResult[]>>();
const SEARCH_TTL = 300_000;
const chartCacheMap = new Map<string, CacheEntry<ChartBar[]>>();
const CHART_TTL = 60_000;

// Keys come from request input, so cap each cache to keep a warm instance's memory bounded.
const MAX_CACHE_ENTRIES = 500;

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T) {
  cache.delete(key);
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Maps iterate in insertion order, so the first key is the oldest entry.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}

export const CHART_RANGES = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y"] as const;
export const CHART_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "1d", "1wk", "1mo"] as const;

/** The subset of yahoo-finance2's (untyped) quote fields this app reads. */
interface RawYahooQuote {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  trailingPE?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  regularMarketPreviousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  epsTrailingTwelveMonths?: number;
  averageDailyVolume3Month?: number;
  averageDailyVolume10Day?: number;
  sector?: string;
  fullExchangeName?: string;
  exchange?: string;
  quoteType?: string;
}

export interface MappedQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
  volume: number;
  marketCap: number;
  pe: number | null;
  dayHigh: number;
  dayLow: number;
  open: number;
  previousClose: number;
  yearHigh: number;
  yearLow: number;
  eps: number | null;
  avgVolume: number;
  sector: string;
  exchange: string;
  quoteType: string;
}

export function mapQuote(q: RawYahooQuote): MappedQuote {
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
    previousClose: q.regularMarketPreviousClose ?? q.regularMarketPrice ?? 0,
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

export async function fetchQuotes(symbols: string[]): Promise<MappedQuote[]> {
  const results: MappedQuote[] = [];
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
    const yahooFinance = yahooClient();
    const fetched = await Promise.allSettled(
      toFetch.map(async (sym) => yahooFinance.quote(sym))
    );
    for (let i = 0; i < toFetch.length; i++) {
      const result = fetched[i];
      if (result.status === "fulfilled" && result.value) {
        // yahoo-finance2's return type is untyped (yahooClient(): any); narrow at this boundary only.
        const mapped = mapQuote(result.value as RawYahooQuote);
        setCached(quoteCache, toFetch[i], mapped);
        results.push(mapped);
      } else if (result.status === "rejected") {
        console.warn("Quote rejected for", toFetch[i], result.reason?.message || result.reason);
      }
    }
  }

  const resultMap = new Map(results.map((r) => [r.symbol, r]));
  return symbols.map((s) => resultMap.get(s)).filter((q): q is MappedQuote => q != null);
}

/** The subset of yahoo-finance2's (untyped) search-result fields this app reads. */
interface RawYahooSearchResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchDisp?: string;
  exchange?: string;
}

export interface MappedSearchResult {
  symbol: string;
  name: string;
  type: string | undefined;
  exchange: string | undefined;
}

export async function searchStocks(query: string): Promise<MappedSearchResult[]> {
  const cacheKey = query.toLowerCase();
  const cached = searchCacheMap.get(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_TTL) return cached.data;

  const result = await yahooClient().search(query, { newsCount: 0 });
  // yahoo-finance2's return type is untyped (yahooClient(): any); narrow at this boundary only.
  const quotes = (result.quotes || []) as RawYahooSearchResult[];
  const mapped = quotes
    .filter((r) => ["EQUITY", "ETF", "INDEX", "MUTUALFUND"].includes(r.quoteType ?? ""))
    .slice(0, 12)
    .map((r) => ({
      symbol: r.symbol,
      name: r.shortname || r.longname || r.symbol,
      type: r.quoteType,
      exchange: r.exchDisp || r.exchange,
    }));

  setCached(searchCacheMap, cacheKey, mapped);
  return mapped;
}

/** The subset of yahoo-finance2's (untyped) chart-bar fields this app reads. */
interface RawYahooChartBar {
  date?: string | number | Date;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export interface ChartBar {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
}

export async function fetchChart(symbol: string, range = "6mo", interval = "1d"): Promise<ChartBar[]> {
  const cacheKey = `${symbol}:${range}:${interval}`;
  const cached = chartCacheMap.get(cacheKey);
  if (cached && Date.now() - cached.ts < CHART_TTL) return cached.data;

  const result = await yahooClient().chart(symbol, {
    period1: getStartDate(range),
    interval: interval as any,
  });

  // yahoo-finance2's return type is untyped (yahooClient(): any); narrow at this boundary only.
  const rawBars = (result.quotes || []) as RawYahooChartBar[];
  const bars = rawBars
    .map((bar) => ({
      date: bar.date ? new Date(bar.date).toISOString().split("T")[0] : "",
      open: bar.open != null ? +bar.open.toFixed(2) : null,
      high: bar.high != null ? +bar.high.toFixed(2) : null,
      low: bar.low != null ? +bar.low.toFixed(2) : null,
      close: bar.close != null ? +bar.close.toFixed(2) : null,
      volume: bar.volume || 0,
    }))
    .filter((b): b is ChartBar => b.close != null);

  setCached(chartCacheMap, cacheKey, bars);
  return bars;
}
