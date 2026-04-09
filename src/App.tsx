import { useState, useCallback, useEffect } from "react";
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
import { SimNewsFeed } from "@/components/SimNewsFeed";
import { Tutorial } from "@/components/Tutorial";
import { AuthScreen } from "@/components/AuthScreen";

import { useFinanceData } from "@/hooks/use-finance-data";
import { useSimulation, type SimSettings } from "@/hooks/use-simulation";
import { useAuth } from "@/hooks/use-auth";
import { fetchJSON, putJSON, postJSON } from "@/lib/finance-api";

const DEFAULT_WATCHLIST = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM",
  "V", "UNH", "BRK-B", "JNJ", "WMT", "MA", "PG"
];

type AppMode = "auth" | "select" | "real" | "sim";

// ─── Real Mode Terminal ──────────────────────────────────────────
function RealTerminal({ isAuthenticated, initialWatchlist }: { isAuthenticated: boolean; initialWatchlist: string[] }) {
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);

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

  // Save watchlist when it changes (debounced)
  useEffect(() => {
    if (!isAuthenticated || loading) return;
    const timeout = setTimeout(() => {
      putJSON("/api/user/watchlist", { symbols: watchlist }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timeout);
  }, [watchlist, isAuthenticated, loading]);

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
      <TopBar onSearch={handleSearch} selectedSymbol={selectedSymbol} searchSymbols={searchSymbols} />
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
function SimTerminal({ settings, onExit, isAuthenticated }: { settings: SimSettings; onExit: () => void; isAuthenticated: boolean }) {
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [watchlist, setWatchlist] = useState(DEFAULT_WATCHLIST);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [showTutorial, setShowTutorial] = useState(true);
  const [saveId, setSaveId] = useState<number | null>(null);

  const baseData = useFinanceData();

  const sim = useSimulation(settings, new Map(
    baseData.getAllStocks().map(s => [s.symbol, s])
  ));

  // Auto-save simulation every 30 seconds if authenticated
  useEffect(() => {
    if (!isAuthenticated || baseData.loading) return;
    const interval = setInterval(() => {
      const portfolio = {
        cash: sim.cash,
        holdings: sim.holdings,
        trades: sim.trades,
      };
      postJSON("/api/user/sim-save", {
        id: saveId,
        name: "Auto-save",
        settings,
        portfolio,
        watchlist,
        dayNumber: sim.dayNumber,
        simTime: sim.simTime.toISOString(),
      }).then((data: any) => {
        if (data.id && !saveId) setSaveId(data.id);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, baseData.loading, sim.cash, sim.holdings, sim.trades, sim.dayNumber, sim.simTime, saveId, settings, watchlist]);

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
      onExit();
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
  }, [sim.getStock, sim.addStock, baseData.addSymbol, onExit]);

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
      <TopBar onSearch={handleSearch} selectedSymbol={selectedSymbol} simMode searchSymbols={baseData.searchSymbols} />
      <TimeControlBar simTime={sim.simTime} dayNumber={sim.dayNumber} timeSpeed={sim.timeSpeed} onSetSpeed={sim.setTimeSpeed} />
      <div className="flex-1 min-h-0 min-w-0 grid grid-cols-[195px_minmax(0,1fr)_260px] grid-rows-[1fr_1fr] gap-px bg-border p-px overflow-hidden">
        <div className="row-span-2 min-h-0">
          <WatchlistPanel symbols={watchlist} getStock={sim.getStock} onSelectSymbol={setSelectedSymbol} selectedSymbol={selectedSymbol} onRemoveSymbol={handleRemoveSymbol} />
        </div>
        <div className="min-h-0">
          <PriceChart symbol={selectedSymbol} stock={currentStock} historicalData={historicalData} />
        </div>
        <div className="min-h-0">
          <PortfolioPanel cash={sim.cash} holdings={sim.holdings} trades={sim.trades} startingCash={settings.startingCash} getPortfolioValue={sim.getPortfolioValue} getTotalPnL={sim.getTotalPnL} getHoldingPnL={sim.getHoldingPnL} getStock={sim.getStock} onBuy={sim.buyStock} onSell={sim.sellStock} selectedSymbol={selectedSymbol} onSelectSymbol={setSelectedSymbol} />
        </div>
        <div className="min-h-0 min-w-0 grid grid-cols-2 gap-px bg-border overflow-hidden">
          <MarketMovers gainers={sim.getTopGainers()} losers={sim.getTopLosers()} active={sim.getMostActive()} onSelectSymbol={setSelectedSymbol} />
          <SectorHeatmap stocks={sim.getAllStocks()} onSelectSymbol={setSelectedSymbol} />
        </div>
        <div className="min-h-0">
          <SimNewsFeed news={sim.news} selectedSymbol={selectedSymbol} />
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
  const auth = useAuth();

  // Load user watchlist when authenticated
  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchJSON<{ symbols: string[] }>("/api/user/watchlist")
        .then((data) => {
          if (data.symbols?.length > 0) setUserWatchlist(data.symbols);
          setMode("select");
        })
        .catch(() => setMode("select"));
    }
  }, [auth.isAuthenticated]);

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
          onSelectSim={(settings) => {
            setSimSettings(settings);
            setMode("sim");
          }}
        />
      )}
      {mode === "real" && <RealTerminal isAuthenticated={auth.isAuthenticated} initialWatchlist={userWatchlist} />}
      {mode === "sim" && simSettings && (
        <SimTerminal settings={simSettings} onExit={() => setMode("select")} isAuthenticated={auth.isAuthenticated} />
      )}
      <Toaster />
    </QueryClientProvider>
  );
}
