import { useState, useCallback, useEffect, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TopBar } from "@/components/TopBar";
import { IndexTicker } from "@/components/IndexTicker";
import { WatchlistPanel } from "@/components/WatchlistPanel";
import { PriceChart } from "@/components/PriceChart";
import { MarketMovers } from "@/components/MarketMovers";
import { StockDetail } from "@/components/StockDetail";
import { NewsFeed } from "@/components/NewsFeed";
import { SectorHeatmap } from "@/components/SectorHeatmap";
import { CommandBar } from "@/components/CommandBar";
import { ModeSelect } from "@/components/ModeSelect";
import { TimeControlBar } from "@/components/TimeControlBar";
import { PortfolioPanel } from "@/components/PortfolioPanel";
import { SimNewsPanel } from "@/components/SimNewsPanel";
import { Tutorial } from "@/components/Tutorial";
import { AuthScreen } from "@/components/AuthScreen";
import { SaveSelect } from "@/components/SaveSelect";
import { EventLeaderboard } from "@/components/EventLeaderboard";
import { EventComplete } from "@/components/EventComplete";

import { useFinanceData } from "@/hooks/use-finance-data";
import { useSimulation, type SimSettings, type SimInitialState, type Holding, type TradeRecord } from "@/hooks/use-simulation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  getWatchlist, saveWatchlist, upsertSimSave, listSimSaves, deleteSimSave,
  getEventParticipant, joinEvent, updateEventProgress, completeEvent as completeEventApi,
  getCompletedEvents, getEventLeaderboard,
  type SimSaveRow, type EventParticipantRow,
} from "@/lib/supabase";
import { getCurrentEvent, type EventDefinition } from "@/lib/events";

const DEFAULT_WATCHLIST = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM",
  "V", "UNH", "BRK-B", "JNJ", "WMT", "MA", "PG"
];

type AppMode = "auth" | "select" | "save-select" | "sim-settings" | "real" | "sim" | "event";

// ─── Helpers: Serialize / Deserialize portfolio ──────────────────
function serializePortfolio(cash: number, holdings: Map<string, Holding>, trades: TradeRecord[]) {
  return {
    version: 1,
    cash,
    holdings: Array.from(holdings.entries()), // [[symbol, Holding], ...]
    trades: trades.map(t => ({ ...t, timestamp: t.timestamp.toISOString() })),
  };
}

function deserializePortfolio(portfolio: any): { cash: number; holdings: Map<string, Holding>; trades: TradeRecord[] } {
  const cash = typeof portfolio?.cash === "number" ? portfolio.cash : 0;
  const holdings = new Map<string, Holding>(portfolio?.holdings ?? []);
  const trades: TradeRecord[] = (portfolio?.trades ?? []).map((t: any) => ({
    ...t,
    timestamp: new Date(t.timestamp),
  }));
  return { cash, holdings, trades };
}

function deserializeSaveToInitialState(save: SimSaveRow): SimInitialState {
  const { cash, holdings, trades } = deserializePortfolio(save.portfolio);
  return {
    cash,
    holdings,
    trades,
    dayNumber: save.day_number,
    simTime: new Date(save.sim_time),
  };
}

// ─── Real Mode Terminal ──────────────────────────────────────────
function RealTerminal({ userId, initialWatchlist, onHome, onAuth }: { userId: string | null; initialWatchlist: string[]; onHome: () => void; onAuth: () => void }) {
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const { toast } = useToast();

  const {
    loading,
    getStock,
    getAllStocks,
    getIndices,
    fetchHistorical,
    getTopGainers,
    getTopLosers,
    getMostActive,
    addSymbol,
    searchSymbols,
  } = useFinanceData();

  // Save watchlist when it changes (debounced) — surface errors to toast
  useEffect(() => {
    if (!userId || loading) return;
    const timeout = setTimeout(() => {
      saveWatchlist(userId, watchlist).catch((err) => {
        console.error("saveWatchlist failed:", err);
        toast({
          title: "Watchlist save failed",
          description: "Your changes may not persist. Check your connection.",
          variant: "destructive",
        });
      });
    }, 2000);
    return () => clearTimeout(timeout);
  }, [watchlist, userId, loading, toast]);

  useEffect(() => {
    if (!loading && selectedSymbol) {
      fetchHistorical(selectedSymbol).then(data => setHistoricalData(data));
    }
  }, [selectedSymbol, loading, fetchHistorical]);

  const handleSearch = useCallback(async (query: string) => {
    const upper = query.toUpperCase();
    const stock = await addSymbol(upper);
    if (stock) {
      setSelectedSymbol(stock.symbol);
      setWatchlist(prev => prev.includes(stock.symbol) ? prev : [...prev, stock.symbol]);
    }
  }, [addSymbol]);

  const handleCommand = useCallback(async (cmd: string) => {
    setCommandHistory(prev => [...prev, cmd]);
    const upper = cmd.toUpperCase();
    const stock = await addSymbol(upper);
    if (stock) {
      setSelectedSymbol(stock.symbol);
      setWatchlist(prev => prev.includes(stock.symbol) ? prev : [...prev, stock.symbol]);
    }
  }, [addSymbol]);

  const handleRemoveSymbol = useCallback((symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
  }, []);

  const currentStock = getStock(selectedSymbol);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto animate-pulse">
            <rect x="2" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" />
            <rect x="14" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.7" />
            <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.5" />
            <rect x="14" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.3" />
          </svg>
          <div className="text-bb-orange font-bold text-sm tracking-wider">BLOOMBERG TERMINAL</div>
          <div className="text-muted-foreground text-xs">Connecting to Yahoo Finance...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden select-none" data-testid="terminal">
      <TopBar onSearch={handleSearch} selectedSymbol={selectedSymbol} searchSymbols={searchSymbols} onHome={onHome} onAuth={onAuth} />
      <IndexTicker indices={getIndices()} />
      <div className="flex-1 min-h-0 min-w-0 grid grid-cols-[195px_minmax(0,1fr)_240px] grid-rows-[1fr_1fr] gap-px bg-border p-px overflow-hidden">
        <div className="row-span-2 min-h-0">
          <WatchlistPanel symbols={watchlist} getStock={getStock} onSelectSymbol={setSelectedSymbol} selectedSymbol={selectedSymbol} onRemoveSymbol={handleRemoveSymbol} />
        </div>
        <div className="min-h-0">
          <PriceChart symbol={selectedSymbol} stock={currentStock} historicalData={historicalData} />
        </div>
        <div className="min-h-0">
          <StockDetail stock={currentStock} />
        </div>
        <div className="min-h-0 min-w-0 grid grid-cols-2 gap-px bg-border overflow-hidden">
          <MarketMovers gainers={getTopGainers()} losers={getTopLosers()} active={getMostActive()} onSelectSymbol={setSelectedSymbol} />
          <SectorHeatmap stocks={getAllStocks()} onSelectSymbol={setSelectedSymbol} />
        </div>
        <div className="min-h-0">
          <NewsFeed selectedSymbol={selectedSymbol} />
        </div>
      </div>
      <CommandBar onCommand={handleCommand} commandHistory={commandHistory} />
    </div>
  );
}

// ─── Simulation Terminal ─────────────────────────────────────────
function SimTerminal({
  settings,
  onExit,
  userId,
  initialSave,
  onAuth,
}: {
  settings: SimSettings;
  onExit: () => void;
  userId: string | null;
  initialSave: SimSaveRow | null;
  onAuth: () => void;
}) {
  // Determine effective settings: saved settings override prop when continuing a save
  const effectiveSettings: SimSettings = initialSave?.settings ?? settings;

  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [watchlist, setWatchlist] = useState(
    initialSave?.watchlist ?? DEFAULT_WATCHLIST
  );
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [showTutorial, setShowTutorial] = useState(!initialSave); // Skip tutorial on continue
  const [saveId, setSaveId] = useState<string | null>(initialSave?.id ?? null);
  const [saveName, setSaveName] = useState(initialSave?.name ?? "Untitled");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Build initial state from save for rehydration
  const initialState: SimInitialState | undefined = initialSave
    ? deserializeSaveToInitialState(initialSave)
    : undefined;

  const baseData = useFinanceData();
  const hasMountedRef = useRef(false);

  const sim = useSimulation(
    effectiveSettings,
    new Map(baseData.getAllStocks().map(s => [s.symbol, s])),
    initialState,
    undefined,
    undefined,
    saveId,
  );

  // Mark mounted after first render
  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  // ─── Perform a save (shared between auto-save and manual) ─────
  const performSave = useCallback(async () => {
    if (!userId || baseData.loading) return;
    setSaveStatus("saving");
    const portfolio = serializePortfolio(sim.cash, sim.holdings, sim.trades);
    try {
      const newId = await upsertSimSave(userId, {
        id: saveId,
        name: saveName || "Untitled",
        settings: effectiveSettings,
        portfolio,
        watchlist,
        day_number: sim.dayNumber,
        sim_time: sim.simTime.toISOString(),
      });
      if (newId && !saveId) setSaveId(newId);
      setLastSavedAt(new Date());
      setSaveStatus("saved");
      // Reset back to idle after 2s
      setTimeout(() => setSaveStatus(prev => prev === "saved" ? "idle" : prev), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(prev => prev === "error" ? "idle" : prev), 3000);
    }
  }, [userId, baseData.loading, sim.cash, sim.holdings, sim.trades, sim.dayNumber, sim.simTime, saveId, saveName, effectiveSettings, watchlist]);

  // ─── Debounced auto-save (2s debounce on state change) ────────
  useEffect(() => {
    if (!userId || baseData.loading || !hasMountedRef.current) return;
    const timeout = setTimeout(() => {
      performSave();
    }, 2000);
    return () => clearTimeout(timeout);
  // Only trigger on meaningful state changes (not every re-render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.cash, sim.dayNumber, userId]);

  const handleSearch = useCallback(async (query: string) => {
    const upper = query.toUpperCase();
    const existing = sim.getStock(upper);
    if (existing) {
      setSelectedSymbol(upper);
      setWatchlist(prev => prev.includes(upper) ? prev : [...prev, upper]);
      return;
    }
    const stock = await baseData.addSymbol(upper);
    if (stock) {
      sim.addStock(stock);
      setSelectedSymbol(stock.symbol);
      setWatchlist(prev => prev.includes(stock.symbol) ? prev : [...prev, stock.symbol]);
    }
  }, [sim.getStock, sim.addStock, baseData.addSymbol]);

  const handleCommand = useCallback(async (cmd: string) => {
    setCommandHistory(prev => [...prev, cmd]);
    if (cmd === "EXIT" || cmd === "QUIT") {
      // Save before exiting
      await performSave();
      onExit();
      return;
    }
    if (cmd === "SAVE") {
      performSave();
      return;
    }
    const upper = cmd.toUpperCase();
    const existing = sim.getStock(upper);
    if (existing) {
      setSelectedSymbol(upper);
      setWatchlist(prev => prev.includes(upper) ? prev : [...prev, upper]);
      return;
    }
    const stock = await baseData.addSymbol(upper);
    if (stock) {
      sim.addStock(stock);
      setSelectedSymbol(stock.symbol);
      setWatchlist(prev => prev.includes(stock.symbol) ? prev : [...prev, stock.symbol]);
    }
  }, [sim.getStock, sim.addStock, baseData.addSymbol, onExit, performSave]);

  const handleRemoveSymbol = useCallback((symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
  }, []);

  const currentStock = sim.getStock(selectedSymbol);
  const historicalData = sim.getSimHistorical(selectedSymbol);

  if (baseData.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto animate-pulse">
            <rect x="2" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" />
            <rect x="14" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.7" />
            <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.5" />
            <rect x="14" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.3" />
          </svg>
          <div className="text-bb-orange font-bold text-sm tracking-wider">SIMULATION MODE</div>
          <div className="text-muted-foreground text-xs">Initializing market simulation...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden select-none" data-testid="sim-terminal">
      {showTutorial && <Tutorial onComplete={() => setShowTutorial(false)} />}
      <TopBar onSearch={handleSearch} selectedSymbol={selectedSymbol} simMode searchSymbols={baseData.searchSymbols} onHome={onExit} onAuth={onAuth} />
      <TimeControlBar
        simTime={sim.simTime}
        dayNumber={sim.dayNumber}
        timeSpeed={sim.timeSpeed}
        onSetSpeed={sim.setTimeSpeed}
        saveName={userId ? saveName : undefined}
        onSaveNameChange={userId ? setSaveName : undefined}
        onManualSave={userId ? performSave : undefined}
        saveStatus={userId ? saveStatus : undefined}
        lastSavedAt={userId ? lastSavedAt : undefined}
      />
      <div className="flex-1 min-h-0 min-w-0 grid grid-cols-[195px_minmax(0,1fr)_260px] grid-rows-[1fr_1fr] gap-px bg-border p-px overflow-hidden">
        <div className="row-span-2 min-h-0">
          <WatchlistPanel symbols={watchlist} getStock={sim.getStock} onSelectSymbol={setSelectedSymbol} selectedSymbol={selectedSymbol} onRemoveSymbol={handleRemoveSymbol} />
        </div>
        <div className="min-h-0">
          <PriceChart symbol={selectedSymbol} stock={currentStock} historicalData={historicalData} intradayTicks={sim.intradayTicks.get(selectedSymbol) ?? []} />
        </div>
        <div className="min-h-0">
          <PortfolioPanel cash={sim.cash} holdings={sim.holdings} trades={sim.trades} startingCash={effectiveSettings.startingCash} getPortfolioValue={sim.getPortfolioValue} getTotalPnL={sim.getTotalPnL} getHoldingPnL={sim.getHoldingPnL} getStock={sim.getStock} onBuy={sim.buyStock} onSell={sim.sellStock} selectedSymbol={selectedSymbol} onSelectSymbol={setSelectedSymbol} />
        </div>
        <div className="min-h-0 min-w-0 grid grid-cols-2 gap-px bg-border overflow-hidden">
          <MarketMovers gainers={sim.getTopGainers()} losers={sim.getTopLosers()} active={sim.getMostActive()} onSelectSymbol={setSelectedSymbol} />
          <SectorHeatmap stocks={sim.getAllStocks()} onSelectSymbol={setSelectedSymbol} />
        </div>
        <div className="min-h-0">
          <SimNewsPanel
            aiNews={sim.aiNews}
            loading={sim.aiNewsLoading}
            error={sim.aiNewsError}
            onRetry={sim.triggerAINewsFetch}
            onUpdateNews={sim.setAiNews}
            sectors={[...new Set(sim.getAllStocks().map(s => s.sector).filter(Boolean))]}
            companies={sim.getAllStocks().map(s => ({ symbol: s.symbol, name: s.name }))}
            stocks={sim.getAllStocks().map(s => ({ symbol: s.symbol, name: s.name, price: s.price, sector: s.sector || "Unknown", marketCap: s.marketCap || 0 }))}
            variation={sim.simVariation}
          />
        </div>
      </div>
      <CommandBar onCommand={handleCommand} commandHistory={commandHistory} />
    </div>
  );
}

// ─── Event Terminal ──────────────────────────────────────────────
function EventTerminal({
  event,
  participant,
  onExit,
  userId,
  displayName,
  onAuth,
}: {
  event: EventDefinition;
  participant: EventParticipantRow;
  onExit: () => void;
  userId: string;
  displayName: string;
  onAuth: () => void;
}) {
  const eventSettings: SimSettings = {
    startingCash: event.startingCash,
    variation: event.variation,
  };

  // Build initial state from participant if resuming
  const initialState: SimInitialState | undefined = participant.current_day > 1 && participant.portfolio
    ? {
        cash: participant.portfolio.cash ?? event.startingCash,
        holdings: new Map<string, Holding>(participant.portfolio.holdings ?? []),
        trades: (participant.portfolio.trades ?? []).map((t: any) => ({
          ...t,
          timestamp: new Date(t.timestamp),
        })),
        dayNumber: participant.current_day,
        simTime: (() => {
          const d = new Date();
          d.setHours(9, 30, 0, 0);
          return d;
        })(),
      }
    : undefined;

  const eventWatchlist = event.allowedSymbols ?? [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM",
    "V", "UNH", "BRK-B", "JNJ", "WMT", "MA", "PG"
  ];

  const [selectedSymbol, setSelectedSymbol] = useState(eventWatchlist[0] || "AAPL");
  const [watchlist, setWatchlist] = useState(eventWatchlist);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [showComplete, setShowComplete] = useState(false);
  const [leaderboardRank, setLeaderboardRank] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [eventPanel, setEventPanel] = useState<"leaderboard" | "news">("leaderboard");

  const baseData = useFinanceData();

  const handleDayCapReached = useCallback(() => {
    setShowComplete(true);
  }, []);

  const sim = useSimulation(
    eventSettings,
    new Map(baseData.getAllStocks().map(s => [s.symbol, s])),
    initialState,
    event.durationDays,
    handleDayCapReached,
    `event_${participant.id}`,
  );

  // ─── Sync progress to Supabase ────────────────────────────────
  const lastSyncedDay = useRef(participant.current_day);
  useEffect(() => {
    if (baseData.loading) return;
    if (sim.dayNumber === lastSyncedDay.current && !showComplete) return;
    lastSyncedDay.current = sim.dayNumber;

    const profit = +(sim.getPortfolioValue() - event.startingCash).toFixed(2);
    const portfolio = serializePortfolio(sim.cash, sim.holdings, sim.trades);

    if (showComplete) {
      // Compute final stats
      const finalStats = {
        portfolioValue: sim.getPortfolioValue(),
        profit,
        totalTrades: sim.trades.length,
        dailySnapshots: sim.dailySnapshots,
      };
      completeEventApi(participant.id, profit, portfolio, sim.dayNumber, finalStats).then(() => {
        // Fetch rank after completing
        getEventLeaderboard(event.eventKey).then(lb => {
          const rank = lb.findIndex(p => p.user_id === userId) + 1;
          setLeaderboardRank(rank || lb.length);
          setTotalParticipants(lb.length);
        });
      });
    } else {
      updateEventProgress(participant.id, sim.dayNumber, profit, portfolio);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.dayNumber, showComplete]);

  // ─── Periodic profit sync (every 15s while running) ────────────
  useEffect(() => {
    if (baseData.loading || showComplete) return;
    const interval = setInterval(() => {
      if (sim.timeSpeed === "paused") return;
      const profit = +(sim.getPortfolioValue() - event.startingCash).toFixed(2);
      const portfolio = serializePortfolio(sim.cash, sim.holdings, sim.trades);
      updateEventProgress(participant.id, sim.dayNumber, profit, portfolio);
    }, 15_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseData.loading, showComplete, sim.timeSpeed]);

  const handleSearch = useCallback(async (query: string) => {
    const upper = query.toUpperCase();
    // Only allow searching within event-allowed stocks
    if (event.allowedSymbols && !event.allowedSymbols.includes(upper)) return;
    const existing = sim.getStock(upper);
    if (existing) {
      setSelectedSymbol(upper);
      setWatchlist(prev => prev.includes(upper) ? prev : [...prev, upper]);
      return;
    }
    const stock = await baseData.addSymbol(upper);
    if (stock) {
      sim.addStock(stock);
      setSelectedSymbol(stock.symbol);
      setWatchlist(prev => prev.includes(stock.symbol) ? prev : [...prev, stock.symbol]);
    }
  }, [sim.getStock, sim.addStock, baseData.addSymbol, event.allowedSymbols]);

  const handleCommand = useCallback(async (cmd: string) => {
    setCommandHistory(prev => [...prev, cmd]);
    if (cmd === "EXIT" || cmd === "QUIT") {
      onExit();
      return;
    }
    const upper = cmd.toUpperCase();
    if (event.allowedSymbols && !event.allowedSymbols.includes(upper)) return;
    const existing = sim.getStock(upper);
    if (existing) {
      setSelectedSymbol(upper);
      setWatchlist(prev => prev.includes(upper) ? prev : [...prev, upper]);
      return;
    }
    const stock = await baseData.addSymbol(upper);
    if (stock) {
      sim.addStock(stock);
      setSelectedSymbol(stock.symbol);
      setWatchlist(prev => prev.includes(stock.symbol) ? prev : [...prev, stock.symbol]);
    }
  }, [sim.getStock, sim.addStock, baseData.addSymbol, onExit, event.allowedSymbols]);

  const handleRemoveSymbol = useCallback((symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
  }, []);

  const currentStock = sim.getStock(selectedSymbol);
  const historicalData = sim.getSimHistorical(selectedSymbol);

  if (baseData.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto animate-pulse">
            <rect x="2" y="2" width="8" height="8" rx="1" fill="hsl(187, 80%, 55%)" />
            <rect x="14" y="2" width="8" height="8" rx="1" fill="hsl(187, 80%, 55%)" opacity="0.7" />
            <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(187, 80%, 55%)" opacity="0.5" />
            <rect x="14" y="14" width="8" height="8" rx="1" fill="hsl(187, 80%, 55%)" opacity="0.3" />
          </svg>
          <div className="text-bb-cyan font-bold text-sm tracking-wider">EVENT MODE</div>
          <div className="text-muted-foreground text-xs">Loading {event.name}...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden select-none" data-testid="event-terminal">
      {showComplete && (
        <EventComplete
          event={event}
          finalCash={sim.cash}
          holdings={sim.holdings}
          trades={sim.trades}
          dayNumber={sim.dayNumber}
          getStock={sim.getStock}
          portfolioValue={sim.getPortfolioValue()}
          leaderboardRank={leaderboardRank}
          totalParticipants={totalParticipants}
          dailySnapshots={sim.dailySnapshots}
          onViewLeaderboard={() => setShowComplete(false)}
          onGoHome={onExit}
        />
      )}
      <TopBar onSearch={handleSearch} selectedSymbol={selectedSymbol} simMode searchSymbols={baseData.searchSymbols} onHome={onExit} onAuth={onAuth} />
      <TimeControlBar
        simTime={sim.simTime}
        dayNumber={sim.dayNumber}
        timeSpeed={sim.timeSpeed}
        onSetSpeed={sim.setTimeSpeed}
        eventMode
        totalEventDays={event.durationDays}
      />
      <div className="flex-1 min-h-0 min-w-0 grid grid-cols-[195px_minmax(0,1fr)_260px] grid-rows-[1fr_1fr] gap-px bg-border p-px overflow-hidden">
        <div className="row-span-2 min-h-0">
          <WatchlistPanel symbols={watchlist} getStock={sim.getStock} onSelectSymbol={setSelectedSymbol} selectedSymbol={selectedSymbol} onRemoveSymbol={handleRemoveSymbol} />
        </div>
        <div className="min-h-0">
          <PriceChart symbol={selectedSymbol} stock={currentStock} historicalData={historicalData} intradayTicks={sim.intradayTicks.get(selectedSymbol) ?? []} />
        </div>
        <div className="min-h-0">
          <PortfolioPanel cash={sim.cash} holdings={sim.holdings} trades={sim.trades} startingCash={event.startingCash} getPortfolioValue={sim.getPortfolioValue} getTotalPnL={sim.getTotalPnL} getHoldingPnL={sim.getHoldingPnL} getStock={sim.getStock} onBuy={sim.buyStock} onSell={sim.sellStock} selectedSymbol={selectedSymbol} onSelectSymbol={setSelectedSymbol} />
        </div>
        <div className="min-h-0 min-w-0 grid grid-cols-2 gap-px bg-border overflow-hidden">
          <MarketMovers gainers={sim.getTopGainers()} losers={sim.getTopLosers()} active={sim.getMostActive()} onSelectSymbol={setSelectedSymbol} />
          <SectorHeatmap stocks={sim.getAllStocks()} onSelectSymbol={setSelectedSymbol} />
        </div>
        <div className="min-h-0 flex flex-col">
          {/* Toggle tabs */}
          <div className="flex border-b border-border shrink-0 bg-[hsl(var(--bb-panel-bg))]">
            <button
              onClick={() => setEventPanel("leaderboard")}
              className={`flex-1 py-1 text-[10px] font-bold tracking-wider transition-colors ${eventPanel === "leaderboard" ? "text-bb-cyan border-b border-bb-cyan" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-leaderboard"
            >
              LEADERBOARD
            </button>
            <button
              onClick={() => setEventPanel("news")}
              className={`flex-1 py-1 text-[10px] font-bold tracking-wider transition-colors ${eventPanel === "news" ? "text-bb-cyan border-b border-bb-cyan" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-news"
            >
              NEWS
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {eventPanel === "leaderboard" ? (
              <EventLeaderboard event={event} userId={userId} />
            ) : (
              <SimNewsPanel
                aiNews={sim.aiNews}
                loading={sim.aiNewsLoading}
                error={sim.aiNewsError}
                onRetry={sim.triggerAINewsFetch}
                onUpdateNews={sim.setAiNews}
                sectors={[...new Set(sim.getAllStocks().map(s => s.sector).filter(Boolean))]}
                companies={sim.getAllStocks().map(s => ({ symbol: s.symbol, name: s.name }))}
                stocks={sim.getAllStocks().map(s => ({ symbol: s.symbol, name: s.name, price: s.price, sector: s.sector || "Unknown", marketCap: s.marketCap || 0 }))}
                variation={sim.simVariation}
              />
            )}
          </div>
        </div>
      </div>
      <CommandBar onCommand={handleCommand} commandHistory={commandHistory} />
    </div>
  );
}

// ─── Root App ────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState<AppMode>("auth");
  const [simSettings, setSimSettings] = useState<SimSettings | null>(null);
  const [userWatchlist, setUserWatchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [savesList, setSavesList] = useState<SimSaveRow[]>([]);
  const [savesLoading, setSavesLoading] = useState(false);
  const [activeSave, setActiveSave] = useState<SimSaveRow | null>(null);
  // Key to force re-mount SimTerminal when switching saves
  const [simKey, setSimKey] = useState(0);
  const [activeEvent, setActiveEvent] = useState<EventDefinition | null>(null);
  const [activeParticipant, setActiveParticipant] = useState<EventParticipantRow | null>(null);
  const [completedEvents, setCompletedEvents] = useState<EventParticipantRow[]>([]);
  const auth = useAuth();
  const { toast } = useToast();

  // Load user watchlist when authenticated, route back to auth on logout
  // Fixed: refetch whenever auth.userId changes, not gated on mode === "auth"
  useEffect(() => {
    if (auth.loading) return;
    if (auth.isAuthenticated && auth.userId) {
      const loadWatchlist = async () => {
        try {
          let symbols = await getWatchlist(auth.userId!);
          // Retry once after 750ms for new signups where trigger may not have fired yet
          if (!symbols || symbols.length === 0) {
            await new Promise(r => setTimeout(r, 750));
            symbols = await getWatchlist(auth.userId!);
          }
          if (symbols && symbols.length > 0) {
            setUserWatchlist(symbols);
          }
        } catch (err) {
          console.error("Failed to load watchlist:", err);
        }
        if (mode === "auth") setMode("select");
      };
      loadWatchlist();
    } else if (!auth.isAuthenticated && mode !== "auth") {
      // User logged out
      setMode("auth");
      setUserWatchlist(DEFAULT_WATCHLIST);
      setSavesList([]);
      setActiveSave(null);
      setActiveEvent(null);
      setActiveParticipant(null);
      setCompletedEvents([]);
    }
  }, [auth.isAuthenticated, auth.userId, auth.loading]); // Removed mode from deps to avoid re-triggering

  // ─── Fetch simulation saves ───────────────────────────────────
  const fetchSaves = useCallback(async () => {
    if (!auth.userId) return;
    setSavesLoading(true);
    try {
      const saves = await listSimSaves(auth.userId);
      setSavesList(saves);
    } catch (err) {
      console.error("Failed to load saves:", err);
      toast({
        title: "Failed to load saves",
        description: "Could not fetch your simulation saves.",
        variant: "destructive",
      });
    } finally {
      setSavesLoading(false);
    }
  }, [auth.userId, toast]);

  // Handler: user clicks "Simulation" on mode select
  const handleSimClick = useCallback(async () => {
    if (!auth.userId) {
      // Not logged in — go straight to settings (no saves)
      setActiveSave(null);
      // Show ModeSelect in settings phase directly (we set mode to select and let ModeSelect handle it)
      // Actually, we need to go to ModeSelect settings phase. Since ModeSelect manages its own phase,
      // we just rely on ModeSelect's internal click handler. But we need to intercept the simulation button.
      return;
    }
    // Logged in — fetch saves and decide routing
    setSavesLoading(true);
    try {
      const saves = await listSimSaves(auth.userId);
      setSavesList(saves);
      if (saves.length === 0) {
        // No saves — skip save picker, go straight to settings
        return; // Let ModeSelect handle the click normally
      }
      // Has saves — show save picker
      setMode("save-select");
    } catch {
      // On error, fall through to settings
    } finally {
      setSavesLoading(false);
    }
  }, [auth.userId]);

  const handleDeleteSave = useCallback(async (id: string) => {
    if (!auth.userId) return;
    try {
      await deleteSimSave(auth.userId, id);
      setSavesList(prev => prev.filter(s => s.id !== id));
      toast({ title: "Save deleted" });
    } catch {
      toast({ title: "Failed to delete save", variant: "destructive" });
    }
  }, [auth.userId, toast]);

  // ─── Handle Join Event ──────────────────────────────────────────
  const handleJoinEvent = useCallback(async (event: EventDefinition) => {
    if (!auth.userId) {
      toast({ title: "Please log in to join events", variant: "destructive" });
      return;
    }

    const displayName = auth.user?.user_metadata?.display_name ?? auth.user?.email?.split("@")[0] ?? "Anonymous";

    try {
      // Check if already participating
      let participant = await getEventParticipant(event.eventKey, auth.userId);

      if (participant) {
        if (participant.status === "completed") {
          toast({ title: "Event already completed", description: "You've already finished this event." });
          return;
        }
        // Resume existing participation
      } else {
        // Join the event
        participant = await joinEvent(event.eventKey, auth.userId, displayName, {
          startingCash: event.startingCash,
          variation: event.variation,
          eventName: event.name,
        });
        if (!participant) {
          toast({ title: "Failed to join event", variant: "destructive" });
          return;
        }
      }

      setActiveEvent(event);
      setActiveParticipant(participant);
      setSimKey(k => k + 1);
      setMode("event");
    } catch (err) {
      console.error("Join event error:", err);
      toast({ title: "Failed to join event", variant: "destructive" });
    }
  }, [auth.userId, auth.user, toast]);

  // ─── Load completed events for save tab ─────────────────────────
  const loadCompletedEvents = useCallback(async () => {
    if (!auth.userId) return;
    try {
      const events = await getCompletedEvents(auth.userId);
      setCompletedEvents(events);
    } catch (err) {
      console.error("Failed to load completed events:", err);
    }
  }, [auth.userId]);

  // If auth is still loading, show splash
  if (auth.loading) {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto animate-pulse">
              <rect x="2" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" />
              <rect x="14" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.7" />
              <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.5" />
              <rect x="14" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.3" />
            </svg>
            <div className="text-bb-orange font-bold text-sm tracking-wider">BLOOMBERG TERMINAL</div>
          </div>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {mode === "auth" && (
        <AuthScreen
          onLogin={async (email, password) => {
            await auth.login(email, password);
            // mode will switch via useEffect when isAuthenticated changes
          }}
          onSignup={async (email, password, displayName) => {
            await auth.signup(email, password, displayName);
          }}
          onSkip={() => setMode("select")}
          error={auth.error}
        />
      )}
      {mode === "select" && (
        <ModeSelect
          onSelectReal={() => setMode("real")}
          onSelectSim={() => {
            // This shouldn't be called in select mode since onSimClick intercepts,
            // but as a fallback, go to sim-settings
            setMode("sim-settings");
          }}
          onSimClick={async () => {
            // Simulation card clicked → go to save-select first
            if (auth.userId) {
              setSavesLoading(true);
              try {
                const saves = await listSimSaves(auth.userId);
                setSavesList(saves);
                await loadCompletedEvents();
              } catch {
                setSavesList([]);
              } finally {
                setSavesLoading(false);
              }
              setMode("save-select");
            } else {
              // Not logged in — go straight to settings (no saves possible)
              setActiveSave(null);
              setMode("sim-settings");
            }
          }}
          userId={auth.userId}
          onJoinEvent={handleJoinEvent}
        />
      )}
      {mode === "save-select" && (
        <SaveSelect
          saves={savesList}
          loading={savesLoading}
          onContinue={(save) => {
            setActiveSave(save);
            setSimSettings(save.settings as SimSettings);
            setSimKey(k => k + 1);
            setMode("sim");
          }}
          onNew={() => {
            if (savesList.length >= 20) {
              toast({
                title: "Save limit reached",
                description: "Delete an old save first. Maximum 20 saves per user.",
                variant: "destructive",
              });
              return;
            }
            setActiveSave(null);
            setMode("sim-settings");
          }}
          onDelete={handleDeleteSave}
          onBack={() => setMode("select")}
          completedEvents={completedEvents}
        />
      )}
      {mode === "sim-settings" && (
        <ModeSelect
          onSelectReal={() => setMode("real")}
          onSelectSim={(settings) => {
            setSimSettings(settings);
            setActiveSave(null);
            setSimKey(k => k + 1);
            setMode("sim");
          }}
          onBack={() => {
            // Go back to save-select if logged in, otherwise mode select
            if (auth.userId) {
              setMode("save-select");
            } else {
              setMode("select");
            }
          }}
          startInSettings
        />
      )}
      {mode === "real" && <RealTerminal userId={auth.userId} initialWatchlist={userWatchlist} onHome={() => setMode("select")} onAuth={() => setMode("auth")} />}
      {mode === "sim" && (simSettings || activeSave) && (
        <SimTerminal
          key={simKey}
          settings={simSettings ?? activeSave!.settings}
          onExit={() => {
            setActiveSave(null);
            setMode("select");
          }}
          userId={auth.userId}
          initialSave={activeSave}
          onAuth={() => setMode("auth")}
        />
      )}
      {mode === "event" && activeEvent && activeParticipant && auth.userId && (
        <EventTerminal
          key={simKey}
          event={activeEvent}
          participant={activeParticipant}
          onExit={() => {
            setActiveEvent(null);
            setActiveParticipant(null);
            setMode("select");
          }}
          userId={auth.userId}
          displayName={auth.user?.user_metadata?.display_name ?? auth.user?.email?.split("@")[0] ?? "Anonymous"}
          onAuth={() => setMode("auth")}
        />
      )}
      <Toaster />
    </QueryClientProvider>
  );
}
