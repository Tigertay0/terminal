import { useState, useEffect, useCallback, useRef } from "react";
import { fetchJSON } from "@/lib/finance-api";

// ─── Types ───────────────────────────────────────────────────────
export interface TickerData {
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
  exchange?: string;
  quoteType?: string;
}

export interface IndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changesPercentage: number;
}

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Default watchlist & index symbols
const DEFAULT_SYMBOLS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM",
  "V", "UNH", "BRK-B", "JNJ", "WMT", "MA", "PG",
  "BAC", "GS", "MS", "PFE", "ABBV", "MRK", "XOM", "CVX", "COP", "HD", "NKE", "SLB", "EOG",
];

const INDEX_SYMBOLS = ["^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX", "^FTSE", "^N225", "^HSI", "^GDAXI"];

// Batch symbols into chunks for API calls
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function useFinanceData() {
  const [stocks, setStocks] = useState<Map<string, TickerData>>(new Map());
  const [indices, setIndices] = useState<Map<string, IndexData>>(new Map());
  const [historicalCache, setHistoricalCache] = useState<Map<string, OHLCVBar[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const allSymbolsRef = useRef<string[]>([...DEFAULT_SYMBOLS]);

  // Fetch quotes from backend
  const fetchQuotes = useCallback(async (symbols: string[]): Promise<TickerData[]> => {
    const results: TickerData[] = [];
    const batches = chunk(symbols, 10);
    for (const batch of batches) {
      try {
        const data = await fetchJSON<TickerData[]>(`/api/yf/quote?symbols=${batch.join(",")}`);
        results.push(...data);
      } catch (e) {
        console.warn("Quote fetch failed for batch:", batch, e);
      }
    }
    return results;
  }, []);

  // Fetch index quotes
  const fetchIndices = useCallback(async (): Promise<IndexData[]> => {
    try {
      const data = await fetchJSON<any[]>(`/api/yf/quote?symbols=${INDEX_SYMBOLS.join(",")}`);
      return data.map(d => ({
        symbol: d.symbol,
        name: d.name,
        price: d.price,
        change: d.change,
        changesPercentage: d.changesPercentage,
      }));
    } catch {
      return [];
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [stockData, indexData] = await Promise.all([
          fetchQuotes(DEFAULT_SYMBOLS),
          fetchIndices(),
        ]);

        if (cancelled) return;

        const stockMap = new Map<string, TickerData>();
        stockData.forEach(s => stockMap.set(s.symbol, s));
        setStocks(stockMap);

        const idxMap = new Map<string, IndexData>();
        indexData.forEach(i => idxMap.set(i.symbol, i));
        setIndices(idxMap);

        setLoading(false);
      } catch (err: any) {
        console.error("Init failed:", err);
        setError(err.message);
        setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [fetchQuotes, fetchIndices]);

  // Real-time refresh every 15 seconds
  useEffect(() => {
    if (loading) return;

    intervalRef.current = setInterval(async () => {
      const symbols = allSymbolsRef.current;
      if (symbols.length === 0) return;

      const [stockData, indexData] = await Promise.all([
        fetchQuotes(symbols),
        fetchIndices(),
      ]);

      if (stockData.length > 0) {
        setStocks(prev => {
          const next = new Map(prev);
          stockData.forEach(s => next.set(s.symbol, s));
          return next;
        });
      }

      if (indexData.length > 0) {
        setIndices(prev => {
          const next = new Map(prev);
          indexData.forEach(i => next.set(i.symbol, i));
          return next;
        });
      }
    }, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loading, fetchQuotes, fetchIndices]);

  // ─── Add a new symbol (from search) ────────────────────────────
  const addSymbol = useCallback(async (symbol: string): Promise<TickerData | null> => {
    const upper = symbol.toUpperCase();
    // If already loaded, just return it
    if (stocks.has(upper)) return stocks.get(upper)!;

    try {
      const data = await fetchQuotes([upper]);
      if (data.length > 0) {
        const stock = data[0];
        setStocks(prev => new Map(prev).set(stock.symbol, stock));
        if (!allSymbolsRef.current.includes(stock.symbol)) {
          allSymbolsRef.current.push(stock.symbol);
        }
        return stock;
      }
    } catch (e) {
      console.warn("Failed to add symbol:", upper, e);
    }
    return null;
  }, [stocks, fetchQuotes]);

  // ─── Historical data ───────────────────────────────────────────
  const getHistorical = useCallback((symbol: string): OHLCVBar[] => {
    return historicalCache.get(symbol) || [];
  }, [historicalCache]);

  const fetchHistorical = useCallback(async (symbol: string, range: string = "6mo"): Promise<OHLCVBar[]> => {
    const cacheKey = `${symbol}:${range}`;
    if (historicalCache.has(cacheKey)) return historicalCache.get(cacheKey)!;

    try {
      const data = await fetchJSON<OHLCVBar[]>(`/api/yf/chart?symbol=${symbol}&range=${range}&interval=1d`);
      setHistoricalCache(prev => {
        const next = new Map(prev);
        next.set(cacheKey, data);
        next.set(symbol, data); // also cache under bare symbol for default access
        return next;
      });
      return data;
    } catch {
      return [];
    }
  }, [historicalCache]);

  // ─── Search ────────────────────────────────────────────────────
  const searchSymbols = useCallback(async (query: string): Promise<{ symbol: string; name: string; type: string; exchange: string }[]> => {
    if (!query || query.length < 1) return [];
    try {
      return await fetchJSON(`/api/yf/search?q=${encodeURIComponent(query)}`);
    } catch {
      return [];
    }
  }, []);

  // ─── Getters ───────────────────────────────────────────────────
  const getStock = useCallback((symbol: string): TickerData | undefined => {
    return stocks.get(symbol);
  }, [stocks]);

  const getAllStocks = useCallback((): TickerData[] => {
    return Array.from(stocks.values());
  }, [stocks]);

  const getIndices = useCallback((): IndexData[] => {
    return Array.from(indices.values());
  }, [indices]);

  const getTopGainers = useCallback((): TickerData[] => {
    return Array.from(stocks.values())
      .sort((a, b) => b.changesPercentage - a.changesPercentage)
      .slice(0, 10);
  }, [stocks]);

  const getTopLosers = useCallback((): TickerData[] => {
    return Array.from(stocks.values())
      .sort((a, b) => a.changesPercentage - b.changesPercentage)
      .slice(0, 10);
  }, [stocks]);

  const getMostActive = useCallback((): TickerData[] => {
    return Array.from(stocks.values())
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
  }, [stocks]);

  return {
    loading,
    error,
    getStock,
    getAllStocks,
    getIndices,
    getHistorical,
    fetchHistorical,
    getTopGainers,
    getTopLosers,
    getMostActive,
    addSymbol,
    searchSymbols,
  };
}

export type { TickerData, IndexData, OHLCVBar };
