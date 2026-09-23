import { useState, useEffect, useCallback, useRef } from "react";
import type { TickerData, OHLCVBar } from "./use-finance-data";
import {
  fetchAINews,
  generateSyntheticNews,
  NewsCoherenceTracker,
  saveNewsToStorage,
  loadNewsFromStorage,
  type AINewsItem,
} from "@/lib/ai-news";
import { generateTemplateNews, loadTemplateHeadlines } from "@/lib/template-news";

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

export interface SimInitialState {
  cash: number;
  holdings: Map<string, Holding>;
  trades: TradeRecord[];
  dayNumber: number;
  simTime: Date;
  simStocks?: Map<string, TickerData>;
}

// ─── Variation multipliers ───────────────────────────────────────
const VARIATION_CONFIGS: Record<MarketVariation, {
  tickVol: number; newsFreq: number; bigEventChance: number;
  rareEventDayChance: number; // chance per day of a boom/crash
}> = {
  low:       { tickVol: 0.04, newsFreq: 0.08, bigEventChance: 0.01, rareEventDayChance: 0.005 },
  realistic: { tickVol: 0.12, newsFreq: 0.15, bigEventChance: 0.03, rareEventDayChance: 0.02 },
  high:      { tickVol: 0.35, newsFreq: 0.25, bigEventChance: 0.08, rareEventDayChance: 0.10 },
};

// ETFs get reduced volatility
const ETF_SYMBOLS = new Set(["SPY", "QQQ", "VOO", "DIA", "IWM", "VTI", "ARKK", "VGT", "XLF", "XLE", "XLK", "SCHD"]);
const ETF_VOL_MULTIPLIER = 0.3;

// Daily price change cap (circuit breaker)
const DAILY_CHANGE_CAP = 0.15; // ±15% max per day

// Mean-reversion threshold (only for stocks > $350)
const MEAN_REVERSION_THRESHOLD = 0.30; // ±30% from start
const MEAN_REVERSION_STRENGTH = 0.002; // gentle pull back
const MEAN_REVERSION_PRICE_FLOOR = 350; // only applies to stocks above this price

// Rare event templates (booms & crashes)
const RARE_BOOM_HEADLINES = [
  "{company} receives surprise regulatory approval, opening $50B market",
  "{company} awarded transformative government contract worth $8B",
  "{company} unveils breakthrough technology, analysts call it 'game-changing'",
  "Activist investor takes 9% stake in {company}, pushes for strategic review",
  "{company} merger agreement sends stock soaring in pre-market",
  "{company} quarterly earnings shatter expectations, revenue up 45%",
  "{company} announces surprise dividend hike and $10B buyback",
  "Major hedge fund reveals massive new position in {ticker}",
];
const RARE_CRASH_HEADLINES = [
  "{company} CEO arrested on federal fraud charges, trading halted",
  "{company} issues profit warning, slashes full-year outlook by 40%",
  "FDA rejects {company}'s flagship drug application, shares plunge",
  "{company} accounting scandal revealed by whistleblower report",
  "Major customer terminates contract with {company}, revenue at risk",
  "{company} faces emergency product recall after safety incidents",
  "Short-seller alleges systematic fraud at {company} in 80-page report",
  "{company} CFO and COO resign simultaneously, board launches review",
];

// ─── Main Hook ───────────────────────────────────────────────────
export function useSimulation(
  settings: SimSettings,
  baseStocks: Map<string, TickerData>,
  initialState?: SimInitialState,
  maxDays?: number,
  onDayCapReached?: () => void,
  saveId?: string | null,
) {
  const [simStocks, setSimStocks] = useState<Map<string, TickerData>>(
    () => initialState?.simStocks ?? new Map()
  );
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
  const [timeSpeed, setTimeSpeed] = useState<TimeSpeed>("paused");
  const [dailySnapshots, setDailySnapshots] = useState<number[]>([]);
  const [historicalCache, setHistoricalCache] = useState<Map<string, OHLCVBar[]>>(new Map());
  const [intradayTicks, setIntradayTicks] = useState<Map<string, IntradayTick[]>>(new Map());

  // ─── AI News state ───────────────────────────────────────────────
  const [aiNews, setAiNews] = useState<AINewsItem[]>(() => loadNewsFromStorage(saveId));
  const [aiNewsLoading, setAiNewsLoading] = useState(false);
  const [aiNewsError, setAiNewsError] = useState<string | null>(null);
  const aiNewsFetchedDay = useRef(-1); // track which day we last fetched
  const aiNewsInFlight = useRef(false);
  const coherenceTracker = useRef(new NewsCoherenceTracker());
  const dayOpenPrices = useRef<Map<string, number>>(new Map()); // track day-open for price move detection

  // Persist news to localStorage whenever it changes (scoped per save)
  useEffect(() => {
    if (aiNews.length > 0) saveNewsToStorage(aiNews, saveId);
  }, [aiNews, saveId]);

  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const tradeIdRef = useRef(0);
  const pendingImpacts = useRef<Map<string, number>>(new Map());

  // Init sim stocks from base
  useEffect(() => {
    if (baseStocks.size > 0 && simStocks.size === 0) {
      setSimStocks(new Map(baseStocks));
    }
  }, [baseStocks]);

  // Load template headlines on mount
  useEffect(() => {
    loadTemplateHeadlines();
  }, []);

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
      for (const sym of symbols) {
        const data = next.get(sym)!;
        const isETF = ETF_SYMBOLS.has(sym);
        const vol = isETF ? config.tickVol * ETF_VOL_MULTIPLIER : config.tickVol;

        // Unbiased random walk (0.5 center = no drift)
        let pct = (Math.random() - 0.5) * 2 * (vol / 100);

        // Fat-tail downward swings for realism (occasional sharp drops)
        if (Math.random() < 0.03) {
          pct -= Math.random() * (vol / 100) * (settings.variation === "high" ? 4 : 2);
        }

        // Mean-reversion for expensive stocks (>$350): pull back if drifted >±30%
        if (data.previousClose >= MEAN_REVERSION_PRICE_FLOOR && !isETF) {
          const driftPct = (data.price - data.previousClose) / data.previousClose;
          if (Math.abs(driftPct) > MEAN_REVERSION_THRESHOLD) {
            pct -= driftPct * MEAN_REVERSION_STRENGTH;
          }
        }

        // Apply pending news impact
        const impactMul = pendingImpacts.current.get(sym) || 1;
        if (impactMul !== 1) {
          pendingImpacts.current.delete(sym);
        }

        let newPrice = +(data.price * (1 + pct) * impactMul).toFixed(2);

        // Yahoo omits previousClose for some tickers (it arrives as 0); fall back to the
        // current price so the breaker doesn't pin the stock at $0.01 and % change isn't Infinity.
        const refClose = data.previousClose > 0 ? data.previousClose : data.price;

        // Daily circuit breaker: cap at ±15% from previousClose
        const maxPrice = +(refClose * (1 + DAILY_CHANGE_CAP)).toFixed(2);
        const minPrice = +(refClose * (1 - DAILY_CHANGE_CAP)).toFixed(2);
        newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));
        // Floor at $0.01
        newPrice = Math.max(0.01, newPrice);

        const change = +(newPrice - refClose).toFixed(2);
        const changePct = refClose > 0 ? +((change / refClose) * 100).toFixed(2) : 0;
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

    // Generate template news (instant, pre-written, no API call) — skip ETFs
    const nonEtfKeys = Array.from(simStocks.keys()).filter(s => !ETF_SYMBOLS.has(s));
    if (nonEtfKeys.length > 0) {
      const randomSym = nonEtfKeys[Math.floor(Math.random() * nonEtfKeys.length)];
      const stock = simStocks.get(randomSym);
      if (stock) {
        const templateItem = generateTemplateNews(randomSym, stock.name, stock.sector || "Unknown");
        if (templateItem) {
          // Check coherence
          if (!coherenceTracker.current.wouldContradict(randomSym, templateItem.sentiment)) {
            coherenceTracker.current.recordSentiment(randomSym, templateItem.sentiment);
            coherenceTracker.current.recordHeadline(randomSym, templateItem.headline);
            // Stamp simulation time
            templateItem.simDay = dayNumber;
            templateItem.simTimeStr = simTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
            setAiNews(prev => [templateItem, ...prev].slice(0, 100));
            // Apply price impact (always < 5%)
            const impactMultiplier = 1 + templateItem.expectedGrowth / 100;
            pendingImpacts.current.set(
              randomSym,
              (pendingImpacts.current.get(randomSym) || 1) * impactMultiplier
            );
          }
        }
      }
    }
  }, [settings.variation, baseStocks, simTime, simStocks]);

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

          // ─── Rare boom/crash event check ────────────────
          const rareConfig = VARIATION_CONFIGS[settings.variation];
          if (Math.random() < rareConfig.rareEventDayChance) {
            // Pick a random non-ETF stock for the event
            const eligibleSymbols = Array.from(simStocks.keys()).filter(s => !ETF_SYMBOLS.has(s));
            if (eligibleSymbols.length > 0) {
              const eventSym = eligibleSymbols[Math.floor(Math.random() * eligibleSymbols.length)];
              const eventStock = simStocks.get(eventSym);
              if (eventStock) {
                const isBoom = Math.random() < 0.35; // 65% chance of crash
                const magnitude = isBoom 
                  ? (0.08 + Math.random() * 0.17) // 8% to 25% for boom
                  : (0.12 + Math.random() * 0.25); // 12% to 37% for crash
                const impactMultiplier = isBoom ? 1 + magnitude : 1 - magnitude;
                const headlines = isBoom ? RARE_BOOM_HEADLINES : RARE_CRASH_HEADLINES;
                const headline = headlines[Math.floor(Math.random() * headlines.length)]
                  .replace(/\{company\}/g, eventStock.name)
                  .replace(/\{ticker\}/g, eventSym);

                // Generate alert news item FIRST (before impact)
                const alertItem: AINewsItem = {
                  id: `rare-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  companyName: eventStock.name,
                  companyId: eventSym,
                  sector: eventStock.sector || "Unknown",
                  headline,
                  summary: "",
                  importance: "high",
                  sentiment: "alert",
                  expectedGrowth: isBoom ? +(magnitude * 100).toFixed(1) : +(-magnitude * 100).toFixed(1),
                  generatedAt: Date.now(),
                  simDay: dayNumber + 1,
                  simTimeStr: "9:30 AM",
                };
                setAiNews(prev => [alertItem, ...prev].slice(0, 100));

                // Schedule the impact (spread over next few ticks)
                pendingImpacts.current.set(eventSym, impactMultiplier);
              }
            }
          }

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
    // A negative count would make the cost negative and add cash
    if (!Number.isFinite(shares) || shares <= 0) return false;
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
    if (!Number.isFinite(shares) || shares <= 0) return false;
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
    // Overlapping fetches (day rollover + manual retry) would compound the same price impacts
    if (simStocks.size === 0 || aiNewsInFlight.current) return;
    aiNewsInFlight.current = true;
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
        if (Math.abs(changePct) > 1.0) {
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
      aiNewsInFlight.current = false;
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

  // Trigger initial AI news fetch for Day 1
  useEffect(() => {
    if (dayNumber === 1 && aiNewsFetchedDay.current < 1 && simStocks.size > 0) {
      aiNewsFetchedDay.current = 1;
      triggerAINewsFetch();
    }
  }, [dayNumber, simStocks.size, triggerAINewsFetch]);

  return {
    // State
    simStocks,
    cash,
    holdings,
    trades,
    simTime,
    dayNumber,
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
    setAiNews,
    aiNewsLoading,
    aiNewsError,
    triggerAINewsFetch,
    simVariation: settings.variation,
  };
}
