import { useState, useEffect, useCallback, useRef } from "react";
import type { TickerData, OHLCVBar } from "./use-finance-data";
import {
  fetchAINews,
  generateSyntheticNews,
  NewsCoherenceTracker,
  type AINewsItem,
  type AINewsState,
} from "@/lib/ai-news";

// ─── Types ───────────────────────────────────────────────────────
export interface IntradayTick {
  time: string; // HH:MM format
  price: number;
  volume: number;
}

export type MarketVariation = "low" | "realistic" | "high";
export type TimeSpeed = "paused" | "1min" | "5min" | "1hr" | "1day";

export interface SimSettings {
  startingCash: number;
  variation: MarketVariation;
}

export interface Holding {
  symbol: string;
  shares: number;
  avgCost: number;
}

export interface TradeRecord {
  id: number;
  symbol: string;
  action: "BUY" | "SELL";
  shares: number;
  price: number;
  timestamp: Date;
}

export interface SimNewsItem {
  id: number;
  title: string;
  source: string;
  time: Date;
  category: string;
  symbol?: string;
  sentiment: "bullish" | "bearish" | "neutral";
  isBreaking?: boolean;
  priceImpact: number; // multiplier, e.g. 1.02 = +2%
}

export interface SimState {
  cash: number;
  holdings: Map<string, Holding>;
  trades: TradeRecord[];
  simTime: Date;
  dayNumber: number;
  news: SimNewsItem[];
  totalPnL: number;
  portfolioValue: number;
}

export interface SimInitialState {
  cash: number;
  holdings: Map<string, Holding>;
  trades: TradeRecord[];
  dayNumber: number;
  simTime: Date;
}

// ─── Variation multipliers ───────────────────────────────────────
const VARIATION_CONFIGS: Record<MarketVariation, { tickVol: number; newsFreq: number; bigEventChance: number }> = {
  low:       { tickVol: 0.04, newsFreq: 0.08, bigEventChance: 0.01 },
  realistic: { tickVol: 0.12, newsFreq: 0.15, bigEventChance: 0.03 },
  high:      { tickVol: 0.35, newsFreq: 0.25, bigEventChance: 0.08 },
};

// ─── News templates ──────────────────────────────────────────────
const BULLISH_TEMPLATES: { title: string; symbols?: string[]; sector?: string }[] = [
  { title: "{sym} Signs Major Government Contract Worth $2.4B", symbols: ["AAPL","MSFT","GOOGL","META","NVDA"] },
  { title: "{sym} Beats Earnings Estimates by 18%, Revenue Up 23%", },
  { title: "{sym} Announces Strategic Acquisition to Expand AI Division", symbols: ["MSFT","GOOGL","META","AMZN"] },
  { title: "{sym} Receives FDA Fast-Track Approval for New Drug", symbols: ["PFE","ABBV","MRK","JNJ","UNH"] },
  { title: "{sym} Reports Record Quarterly Revenue, Raises Guidance", },
  { title: "{sym} Partners with Leading Tech Firm on Cloud Infrastructure", symbols: ["AMZN","MSFT","GOOGL"] },
  { title: "{sym} Announces $5B Share Buyback Program", },
  { title: "{sym} CEO Unveils Revolutionary Product at Annual Conference", symbols: ["AAPL","TSLA","NVDA"] },
  { title: "Analysts Upgrade {sym} to Strong Buy, Raise PT 25%", },
  { title: "{sym} Secures Exclusive Deal with Major Retailer", symbols: ["NKE","PG","WMT"] },
  { title: "{sym} Data Center Revenue Doubles Year-Over-Year", symbols: ["NVDA","MSFT","AMZN","GOOGL"] },
  { title: "{sym} Enters New Market with $1B Investment", },
  { title: "Warren Buffett's Berkshire Reveals Major Stake in {sym}", },
  { title: "{sym} Wins Landmark Patent Case, Stock Soars", },
  { title: "{sym} Reports 40% Surge in International Sales", },
];

const BEARISH_TEMPLATES: { title: string; symbols?: string[]; sector?: string }[] = [
  { title: "{sym} Misses Revenue Estimates, Cuts Forward Guidance", },
  { title: "SEC Opens Investigation Into {sym} Accounting Practices", },
  { title: "{sym} Faces Major Product Recall Affecting Millions", symbols: ["AAPL","TSLA","JNJ","PG"] },
  { title: "{sym} CFO Resigns Amid Internal Review, Shares Plunge", },
  { title: "Major Analyst Downgrades {sym} to Sell, Cites Headwinds", },
  { title: "{sym} Reports Significant Data Breach Affecting Users", symbols: ["META","GOOGL","MSFT","AMZN"] },
  { title: "{sym} Factory Fire Disrupts Supply Chain for Months", },
  { title: "{sym} Loses Key Contract to Competitor, Revenue at Risk", },
  { title: "{sym} Announces Layoffs of 12,000 Employees", symbols: ["META","MSFT","GOOGL","AMZN"] },
  { title: "Short Seller Publishes Damaging Report on {sym}", },
  { title: "{sym} Faces Class Action Lawsuit Over Product Defects", },
  { title: "Insider Selling Surges at {sym}, Executives Dump Shares", },
];

const NEUTRAL_TEMPLATES: { title: string; symbols?: string[] }[] = [
  { title: "Fed Holds Rates Steady, Signals Data-Dependent Approach", },
  { title: "Treasury Yields Stabilize After Week of Volatility", },
  { title: "Oil Prices Flat as OPEC Meetings Continue", },
  { title: "Consumer Confidence Index Meets Expectations", },
  { title: "Unemployment Claims Match Consensus at 215K", },
  { title: "Manufacturing PMI Comes In Line at 50.2", },
  { title: "European Markets Close Mixed on ECB Policy Uncertainty", },
  { title: "Dollar Index Holds Steady Ahead of Jobs Report", },
  { title: "Retail Sales Data Shows Modest Growth of 0.3%", },
  { title: "Housing Starts Match Analyst Forecasts", },
];

const NEWS_SOURCES = ["Bloomberg", "Reuters", "CNBC", "WSJ", "FT", "Barrons", "MarketWatch"];

// ─── Helper ──────────────────────────────────────────────────────
let newsIdCounter = 0;
function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generateSimNews(
  stocks: Map<string, TickerData>,
  variation: MarketVariation,
): SimNewsItem | null {
  const config = VARIATION_CONFIGS[variation];
  if (Math.random() > config.newsFreq) return null;

  const allSymbols = Array.from(stocks.keys());
  const isBigEvent = Math.random() < config.bigEventChance;
  const rand = Math.random();

  let template: { title: string; symbols?: string[]; sector?: string };
  let sentiment: "bullish" | "bearish" | "neutral";
  let impact: number;

  if (rand < 0.40) {
    template = pickRandom(BULLISH_TEMPLATES);
    sentiment = "bullish";
    impact = isBigEvent ? 1.03 + Math.random() * 0.05 : 1.005 + Math.random() * 0.015;
  } else if (rand < 0.70) {
    template = pickRandom(BEARISH_TEMPLATES);
    sentiment = "bearish";
    impact = isBigEvent ? 0.93 + Math.random() * 0.04 : 0.985 - Math.random() * 0.01;
  } else {
    template = pickRandom(NEUTRAL_TEMPLATES);
    sentiment = "neutral";
    impact = 0.998 + Math.random() * 0.004;
  }

  // Symbol-specific templates: pick from intersection of template's symbols and what's loaded
  // so we never produce "undefined" titles.
  let possibleSymbols: string[];
  if (template.symbols && template.symbols.length > 0) {
    const loaded = template.symbols.filter((s) => allSymbols.includes(s));
    possibleSymbols = loaded.length > 0 ? loaded : (allSymbols.length > 0 ? allSymbols : []);
  } else {
    possibleSymbols = allSymbols;
  }

  // For non-neutral templates that need a {sym}, abort if no symbols are available.
  const needsSymbol = template.title.includes("{sym}");
  if (needsSymbol && possibleSymbols.length === 0) return null;

  const sym = needsSymbol ? pickRandom(possibleSymbols) : undefined;
  const title = needsSymbol && sym ? template.title.replace("{sym}", sym) : template.title;

  return {
    id: ++newsIdCounter,
    title,
    source: pickRandom(NEWS_SOURCES),
    time: new Date(),
    category: sentiment === "neutral" || !sym ? "MACRO" : sym,
    symbol: sentiment !== "neutral" ? sym : undefined,
    sentiment,
    isBreaking: isBigEvent,
    priceImpact: impact,
  };
}

// ─── Main Hook ───────────────────────────────────────────────────
export function useSimulation(
  settings: SimSettings,
  baseStocks: Map<string, TickerData>,
  initialState?: SimInitialState,
  maxDays?: number,
  onDayCapReached?: () => void,
) {
  const [simStocks, setSimStocks] = useState<Map<string, TickerData>>(new Map());
  const [cash, setCash] = useState(() => initialState?.cash ?? settings.startingCash);
  const [holdings, setHoldings] = useState<Map<string, Holding>>(
    () => initialState?.holdings ?? new Map()
  );
  const [trades, setTrades] = useState<TradeRecord[]>(() => initialState?.trades ?? []);
  const [simTime, setSimTime] = useState(() => {
    if (initialState?.simTime) return initialState.simTime;
    const d = new Date();
    d.setHours(9, 30, 0, 0);
    return d;
  });
  const [dayNumber, setDayNumber] = useState(() => initialState?.dayNumber ?? 1);
  const [news, setNews] = useState<SimNewsItem[]>([]);
  const [timeSpeed, setTimeSpeed] = useState<TimeSpeed>("paused");
  const [dailySnapshots, setDailySnapshots] = useState<number[]>([]);
  const [historicalCache, setHistoricalCache] = useState<Map<string, OHLCVBar[]>>(new Map());
  const [intradayTicks, setIntradayTicks] = useState<Map<string, IntradayTick[]>>(new Map());

  // ─── AI News state ───────────────────────────────────────────────
  const [aiNews, setAiNews] = useState<AINewsItem[]>([]);
  const [aiNewsLoading, setAiNewsLoading] = useState(false);
  const [aiNewsError, setAiNewsError] = useState<string | null>(null);
  const aiNewsFetchedDay = useRef(-1); // track which day we last fetched
  const coherenceTracker = useRef(new NewsCoherenceTracker());
  const dayOpenPrices = useRef<Map<string, number>>(new Map()); // track day-open for price move detection

  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const tradeIdRef = useRef(0);
  const pendingImpacts = useRef<Map<string, number>>(new Map());

  // Init sim stocks from base
  useEffect(() => {
    if (baseStocks.size > 0 && simStocks.size === 0) {
      setSimStocks(new Map(baseStocks));
    }
  }, [baseStocks]);

  // The tick function — advances prices based on variation + news impacts
  // Only moves prices during market hours (9:30 AM – 4:00 PM ET)
  const tick = useCallback(() => {
    // Check if market is open
    const hours = simTime.getHours();
    const mins = simTime.getMinutes();
    const totalMins = hours * 60 + mins;
    const isMarketOpen = totalMins >= 570 && totalMins < 960; // 9:30 - 16:00

    if (!isMarketOpen) return; // No price movement outside market hours

    const config = VARIATION_CONFIGS[settings.variation];

    setSimStocks(prev => {
      const next = new Map(prev);
      const symbols = Array.from(next.keys());
      // Update all stocks each tick
      for (const sym of symbols) {
        const data = next.get(sym)!;
        // Base random walk
        const pct = (Math.random() - 0.48) * 2 * (config.tickVol / 100);
        // Apply pending news impact
        const impactMul = pendingImpacts.current.get(sym) || 1;
        if (impactMul !== 1) {
          pendingImpacts.current.delete(sym);
        }
        const newPrice = +(data.price * (1 + pct) * impactMul).toFixed(2);
        const change = +(newPrice - data.previousClose).toFixed(2);
        const changePct = +((change / data.previousClose) * 100).toFixed(2);
        next.set(sym, {
          ...data,
          price: newPrice,
          change,
          changesPercentage: changePct,
          dayHigh: Math.max(data.dayHigh, newPrice),
          dayLow: Math.min(data.dayLow, newPrice),
          volume: data.volume + Math.floor(Math.random() * 100000),
        });
      }
      return next;
    });

    // Record intraday ticks for charting
    setIntradayTicks(prev => {
      const next = new Map(prev);
      setSimStocks(stocks => {
        stocks.forEach((data, sym) => {
          const ticks = next.get(sym) ?? [];
          const timeStr = `${String(simTime.getHours()).padStart(2, '0')}:${String(simTime.getMinutes()).padStart(2, '0')}`;
          ticks.push({ time: timeStr, price: data.price, volume: data.volume });
          // Keep max 500 ticks per symbol to prevent memory bloat
          if (ticks.length > 500) ticks.shift();
          next.set(sym, ticks);
        });
        return stocks; // don't actually change state, just reading
      });
      return next;
    });

    // Generate intraday news (only during market hours) — legacy system as coherent small news
    const newsItem = generateSimNews(baseStocks, settings.variation);
    if (newsItem) {
      newsItem.time = new Date(simTime.getTime()); // use sim time
      // Check coherence: don't produce contradictory news for same company
      const sentiment = newsItem.sentiment;
      const sym = newsItem.symbol;
      if (sym && coherenceTracker.current.wouldContradict(sym, sentiment)) {
        // Skip this news item — it contradicts the established sentiment for today
      } else {
        if (sym) {
          coherenceTracker.current.recordSentiment(sym, sentiment);
          coherenceTracker.current.recordHeadline(sym, newsItem.title);
        }
        setNews(prev => [newsItem, ...prev].slice(0, 50));
        // Apply price impact
        if (newsItem.symbol) {
          pendingImpacts.current.set(
            newsItem.symbol,
            (pendingImpacts.current.get(newsItem.symbol) || 1) * newsItem.priceImpact
          );
        }
      }
    }
  }, [settings.variation, baseStocks, simTime]);

  // Time advancement engine
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeSpeed === "paused") return;

    const speedMs: Record<TimeSpeed, number> = {
      paused: 0,
      "1min": 1000,    // 1 sim-minute per real-second
      "5min": 200,     // 5 sim-minutes per real-second  
      "1hr": 100,      // 1 sim-hour per real-second (rapid)
      "1day": 50,      // full day in ~8 seconds
    };

    const advanceMinutes: Record<TimeSpeed, number> = {
      paused: 0,
      "1min": 1,
      "5min": 5,
      "1hr": 60,
      "1day": 60,  // advance 1hr per tick, finishes day in ~8 ticks
    };

    const interval = speedMs[timeSpeed];
    const mins = advanceMinutes[timeSpeed];

    intervalRef.current = setInterval(() => {
      setSimTime(prev => {
        const next = new Date(prev.getTime() + mins * 60 * 1000);
        // If past 4:00 PM, advance to next day 9:30 AM
        if (next.getHours() >= 16) {
          const nextDay = new Date(next);
          nextDay.setDate(nextDay.getDate() + 1);
          // Skip weekends
          while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
            nextDay.setDate(nextDay.getDate() + 1);
          }
          nextDay.setHours(9, 30, 0, 0);
          setDayNumber(d => {
            const newDay = d + 1;
            // Check if day cap reached (event mode)
            if (maxDays && newDay >= maxDays) {
              // Will be handled by the useEffect below
            }
            return newDay;
          });
          // Snapshot portfolio value at end of day
          setDailySnapshots(prev => {
            let value = cash;
            holdings.forEach((h) => {
              const stock = simStocks.get(h.symbol);
              if (stock) value += stock.price * h.shares;
            });
            return [...prev, +value.toFixed(2)];
          });
          // Clear intraday ticks for new day
          setIntradayTicks(new Map());
          // Reset coherence tracker for new day
          coherenceTracker.current.reset();
          // Record day-open prices for price move detection
          setSimStocks(prevStocks => {
            const openPrices = new Map<string, number>();
            prevStocks.forEach((data, sym) => openPrices.set(sym, data.price));
            dayOpenPrices.current = openPrices;
            return prevStocks;
          });
          // Trigger AI news fetch at market close (for next day)
          if (aiNewsFetchedDay.current < dayNumber) {
            aiNewsFetchedDay.current = dayNumber;
            triggerAINewsFetch();
          }
          // Reset day high/low for new day
          setSimStocks(prev => {
            const next = new Map(prev);
            next.forEach((data, sym) => {
              next.set(sym, {
                ...data,
                open: data.price,
                previousClose: data.price,
                dayHigh: data.price,
                dayLow: data.price,
                change: 0,
                changesPercentage: 0,
                volume: 0,
              });
            });
            return next;
          });
          return nextDay;
        }
        return next;
      });
      tick();
    }, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timeSpeed, tick, maxDays, cash, holdings, simStocks]);

  // ─── Day cap check (event mode) ────────────────────────────────
  useEffect(() => {
    if (maxDays && dayNumber >= maxDays && timeSpeed !== "paused") {
      setTimeSpeed("paused");
      onDayCapReached?.();
    }
  }, [dayNumber, maxDays, timeSpeed, onDayCapReached]);


  // ─── Trading actions ───────────────────────────────────────────
  const buyStock = useCallback((symbol: string, shares: number): boolean => {
    const stock = simStocks.get(symbol);
    if (!stock) return false;
    const cost = stock.price * shares;
    if (cost > cash) return false;

    setCash(prev => +(prev - cost).toFixed(2));
    setHoldings(prev => {
      const next = new Map(prev);
      const existing = next.get(symbol);
      if (existing) {
        const totalShares = existing.shares + shares;
        const totalCost = existing.avgCost * existing.shares + stock.price * shares;
        next.set(symbol, {
          symbol,
          shares: totalShares,
          avgCost: +(totalCost / totalShares).toFixed(2),
        });
      } else {
        next.set(symbol, { symbol, shares, avgCost: stock.price });
      }
      return next;
    });
    setTrades(prev => [...prev, {
      id: ++tradeIdRef.current,
      symbol,
      action: "BUY",
      shares,
      price: stock.price,
      timestamp: new Date(simTime.getTime()),
    }]);
    return true;
  }, [simStocks, cash, simTime]);

  const sellStock = useCallback((symbol: string, shares: number): boolean => {
    const holding = holdings.get(symbol);
    if (!holding || holding.shares < shares) return false;
    const stock = simStocks.get(symbol);
    if (!stock) return false;

    const revenue = stock.price * shares;
    setCash(prev => +(prev + revenue).toFixed(2));
    setHoldings(prev => {
      const next = new Map(prev);
      const existing = next.get(symbol)!;
      if (existing.shares === shares) {
        next.delete(symbol);
      } else {
        next.set(symbol, { ...existing, shares: existing.shares - shares });
      }
      return next;
    });
    setTrades(prev => [...prev, {
      id: ++tradeIdRef.current,
      symbol,
      action: "SELL",
      shares,
      price: stock.price,
      timestamp: new Date(simTime.getTime()),
    }]);
    return true;
  }, [holdings, simStocks, simTime]);

  // ─── Portfolio calculations ────────────────────────────────────
  const getPortfolioValue = useCallback((): number => {
    let value = cash;
    holdings.forEach((h) => {
      const stock = simStocks.get(h.symbol);
      if (stock) value += stock.price * h.shares;
    });
    return +value.toFixed(2);
  }, [cash, holdings, simStocks]);

  const getTotalPnL = useCallback((): number => {
    return +(getPortfolioValue() - settings.startingCash).toFixed(2);
  }, [getPortfolioValue, settings.startingCash]);

  const getHoldingPnL = useCallback((symbol: string): number => {
    const holding = holdings.get(symbol);
    if (!holding) return 0;
    const stock = simStocks.get(symbol);
    if (!stock) return 0;
    return +((stock.price - holding.avgCost) * holding.shares).toFixed(2);
  }, [holdings, simStocks]);

  // ─── AI News fetch ──────────────────────────────────────────────
  const triggerAINewsFetch = useCallback(async () => {
    if (simStocks.size === 0) return;
    setAiNewsLoading(true);
    setAiNewsError(null);
    try {
      const stockInputs = Array.from(simStocks.values()).map(s => ({
        symbol: s.symbol,
        name: s.name,
        price: s.price,
        sector: s.sector || "Unknown",
        marketCap: s.marketCap || 0,
      }));
      const items = await fetchAINews(stockInputs, settings.variation);

      // Apply expectedGrowth to pending price impacts with ±20-40% random variance
      items.forEach(item => {
        const stock = simStocks.get(item.companyId);
        if (!stock) return;
        // Add variance: actual impact = expectedGrowth * (0.6 to 1.4)
        const variance = 0.6 + Math.random() * 0.8;
        const actualGrowthPct = item.expectedGrowth * variance;
        const impactMultiplier = 1 + actualGrowthPct / 100;
        pendingImpacts.current.set(
          item.companyId,
          (pendingImpacts.current.get(item.companyId) || 1) * impactMultiplier
        );
        // Track coherence for the new day
        const sentiment = item.expectedGrowth >= 0 ? "bullish" : "bearish";
        coherenceTracker.current.recordSentiment(item.companyId, sentiment as "bullish" | "bearish");
        coherenceTracker.current.recordHeadline(item.companyId, item.headline);
      });

      // Also generate synthetic news for any stocks with >1.5% unexplained price moves
      const synthetics: AINewsItem[] = [];
      simStocks.forEach((data, sym) => {
        const openPrice = dayOpenPrices.current.get(sym);
        if (!openPrice) return;
        const changePct = ((data.price - openPrice) / openPrice) * 100;
        if (Math.abs(changePct) > 1.5) {
          // Check if AI news already covers this stock
          const covered = items.some(i => i.companyId === sym);
          if (!covered) {
            synthetics.push(
              generateSyntheticNews(sym, data.name, data.sector || "Unknown", changePct)
            );
          }
        }
      });

      setAiNews(prev => [...items, ...synthetics, ...prev].slice(0, 100));
    } catch (err: any) {
      console.error("AI news fetch failed:", err);
      setAiNewsError(err.message || "Failed to fetch AI news");
    } finally {
      setAiNewsLoading(false);
    }
  }, [simStocks, settings.variation]);

  // Generate historical for sim
  const getSimHistorical = useCallback((symbol: string): OHLCVBar[] => {
    if (historicalCache.has(symbol)) return historicalCache.get(symbol)!;
    const stock = simStocks.get(symbol) || baseStocks.get(symbol);
    const basePrice = stock?.price || 100;
    const bars: OHLCVBar[] = [];
    let price = basePrice * (0.85 + Math.random() * 0.15);
    const now = new Date();
    for (let i = 180; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const dayChange = (Math.random() - 0.48) * basePrice * 0.025;
      const open = price;
      const close = price + dayChange;
      const high = Math.max(open, close) + Math.random() * basePrice * 0.01;
      const low = Math.min(open, close) - Math.random() * basePrice * 0.01;
      const volume = Math.floor(1000000 + Math.random() * 50000000);
      bars.push({
        date: date.toISOString().split("T")[0],
        open: +open.toFixed(2),
        high: +high.toFixed(2),
        low: +low.toFixed(2),
        close: +close.toFixed(2),
        volume,
      });
      price = close;
    }
    setHistoricalCache(prev => new Map(prev).set(symbol, bars));
    return bars;
  }, [simStocks, baseStocks, historicalCache]);

  return {
    // State
    simStocks,
    cash,
    holdings,
    trades,
    simTime,
    dayNumber,
    news,
    timeSpeed,
    dailySnapshots,
    intradayTicks,
    // Actions
    setTimeSpeed,
    buyStock,
    sellStock,
    // Computed
    getPortfolioValue,
    getTotalPnL,
    getHoldingPnL,
    getSimHistorical,
    // Add a new stock to the simulation (from Yahoo Finance search)
    addStock: useCallback((stock: TickerData) => {
      setSimStocks(prev => {
        if (prev.has(stock.symbol)) return prev;
        const next = new Map(prev);
        next.set(stock.symbol, stock);
        return next;
      });
    }, []),
    // For data compatibility
    getStock: useCallback((sym: string) => simStocks.get(sym), [simStocks]),
    getAllStocks: useCallback(() => Array.from(simStocks.values()), [simStocks]),
    getTopGainers: useCallback(() => Array.from(simStocks.values()).sort((a, b) => b.changesPercentage - a.changesPercentage).slice(0, 10), [simStocks]),
    getTopLosers: useCallback(() => Array.from(simStocks.values()).sort((a, b) => a.changesPercentage - b.changesPercentage).slice(0, 10), [simStocks]),
    getMostActive: useCallback(() => Array.from(simStocks.values()).sort((a, b) => b.volume - a.volume).slice(0, 10), [simStocks]),
    // AI News
    aiNews,
    aiNewsLoading,
    aiNewsError,
    triggerAINewsFetch,
  };
}
