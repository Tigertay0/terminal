import { useState, useCallback, useMemo } from "react";
import { Wallet, TrendingUp, TrendingDown, ShoppingCart, DollarSign, ArrowUpDown, BarChart3 } from "lucide-react";
import type { TickerData } from "@/hooks/use-finance-data";
import type { Holding, TradeRecord } from "@/hooks/use-simulation";
import { formatPrice, formatPercent, formatCurrency } from "@/lib/finance-api";

interface PortfolioPanelProps {
  cash: number;
  holdings: Map<string, Holding>;
  trades: TradeRecord[];
  startingCash: number;
  getPortfolioValue: () => number;
  getTotalPnL: () => number;
  getHoldingPnL: (symbol: string) => number;
  getStock: (symbol: string) => TickerData | undefined;
  onBuy: (symbol: string, shares: number) => boolean;
  onSell: (symbol: string, shares: number) => boolean;
  selectedSymbol: string;
  onSelectSymbol: (sym: string) => void;
}

type Tab = "portfolio" | "trade" | "history" | "stats";

export function PortfolioPanel({
  cash, holdings, trades, startingCash,
  getPortfolioValue, getTotalPnL, getHoldingPnL,
  getStock, onBuy, onSell, selectedSymbol, onSelectSymbol,
}: PortfolioPanelProps) {
  const [tab, setTab] = useState<Tab>("portfolio");
  const [tradeAction, setTradeAction] = useState<"BUY" | "SELL">("BUY");
  const [inputMode, setInputMode] = useState<"shares" | "dollars">("shares");
  const [shares, setShares] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const portfolioValue = getPortfolioValue();
  const totalPnL = getTotalPnL();
  const totalPnLPct = ((totalPnL / startingCash) * 100);

  const currentStock = getStock(selectedSymbol);

  // Compute actual shares to trade based on input mode
  const getTradeShares = useCallback((): number => {
    const val = parseFloat(shares);
    if (!val || val <= 0 || !currentStock) return 0;
    if (inputMode === "dollars") {
      // Convert dollar amount to fractional shares
      return +(val / currentStock.price).toFixed(6);
    }
    return +val.toFixed(6);
  }, [shares, inputMode, currentStock]);

  const handleTrade = useCallback(() => {
    const numShares = getTradeShares();
    if (!numShares || numShares <= 0) {
      setMessage({ text: inputMode === "dollars" ? "Enter a valid dollar amount" : "Enter a valid number of shares", type: "error" });
      return;
    }
    const displayShares = numShares % 1 === 0 ? numShares.toString() : numShares.toFixed(4);
    let success: boolean;
    if (tradeAction === "BUY") {
      success = onBuy(selectedSymbol, numShares);
      if (!success) {
        setMessage({ text: "Insufficient funds", type: "error" });
      } else {
        setMessage({ text: `Bought ${displayShares} ${selectedSymbol}`, type: "success" });
      }
    } else {
      success = onSell(selectedSymbol, numShares);
      if (!success) {
        setMessage({ text: "Insufficient shares", type: "error" });
      } else {
        setMessage({ text: `Sold ${displayShares} ${selectedSymbol}`, type: "success" });
      }
    }
    if (success) setShares("");
    setTimeout(() => setMessage(null), 2500);
  }, [shares, tradeAction, selectedSymbol, onBuy, onSell, getTradeShares, inputMode]);

  const holding = holdings.get(selectedSymbol);
  const maxBuyableShares = currentStock ? +(cash / currentStock.price).toFixed(6) : 0;
  const maxBuyableDollars = cash;
  const maxSellableShares = holding?.shares || 0;
  const maxSellableDollars = currentStock && holding ? +(holding.shares * currentStock.price).toFixed(2) : 0;
  const estimatedCost = currentStock && shares
    ? inputMode === "dollars"
      ? parseFloat(shares || "0")
      : currentStock.price * parseFloat(shares || "0")
    : 0;
  const estimatedShares = currentStock && shares && inputMode === "dollars"
    ? +(parseFloat(shares || "0") / currentStock.price).toFixed(4)
    : null;

  return (
    <div className="bb-panel flex flex-col h-full" data-testid="portfolio-panel">
      {/* Header with KPIs */}
      <div className="bg-[hsl(var(--bb-panel-header))] px-2 py-1.5 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <Wallet className="w-3 h-3 text-bb-orange" />
            <span className="text-[10px] font-bold text-bb-orange tracking-wider">PORTFOLIO</span>
          </div>
          <span className={`text-[10px] font-bold ${totalPnL >= 0 ? "text-bb-green" : "text-bb-red"}`}>
            {totalPnL >= 0 ? "+" : ""}{formatCurrency(totalPnL)} ({totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%)
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[9px] text-muted-foreground">TOTAL VALUE</div>
            <div className="text-[11px] font-bold text-foreground">{formatCurrency(portfolioValue)}</div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground">CASH</div>
            <div className="text-[11px] font-bold text-bb-green">{formatCurrency(cash)}</div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground">INVESTED</div>
            <div className="text-[11px] font-bold text-foreground">{formatCurrency(portfolioValue - cash)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {(["portfolio", "trade", "history", "stats"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1 text-[10px] font-bold tracking-wider transition-colors ${
              tab === t
                ? "text-bb-orange border-b border-bb-orange"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${t}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto bb-scrollbar">
        {tab === "portfolio" && (
          <div>
            {holdings.size === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <ShoppingCart className="w-6 h-6 text-muted-foreground/30 mb-2" />
                <div className="text-[11px] text-muted-foreground">No holdings yet</div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">Select a stock and go to Trade to buy</div>
              </div>
            ) : (
              Array.from(holdings.values()).map(h => {
                const stock = getStock(h.symbol);
                if (!stock) return null;
                const pnl = getHoldingPnL(h.symbol);
                const pnlPct = ((stock.price - h.avgCost) / h.avgCost * 100);
                return (
                  <div
                    key={h.symbol}
                    className={`px-2 py-1.5 border-b border-border/50 cursor-pointer hover:bg-white/[0.02] transition-colors ${
                      selectedSymbol === h.symbol ? "bg-white/[0.04]" : ""
                    }`}
                    onClick={() => onSelectSymbol(h.symbol)}
                    data-testid={`holding-${h.symbol}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-foreground">{h.symbol}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">{h.shares % 1 === 0 ? h.shares : h.shares.toFixed(4)} shs</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-foreground">{formatCurrency(stock.price * h.shares)}</div>
                        <div className={`text-[10px] font-medium ${pnl >= 0 ? "text-bb-green" : "text-bb-red"}`}>
                          {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[9px] text-muted-foreground">Avg: ${formatPrice(h.avgCost)}</span>
                      <span className="text-[9px] text-muted-foreground">Cur: ${formatPrice(stock.price)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "trade" && (
          <div className="p-2 space-y-3">
            {/* Stock info */}
            {currentStock && (
              <div className="bg-white/[0.02] rounded-sm p-2 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-bb-orange">{selectedSymbol}</span>
                  <span className="text-xs font-bold text-foreground">${formatPrice(currentStock.price)}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{currentStock.name}</div>
              </div>
            )}

            {/* Buy/Sell toggle */}
            <div className="grid grid-cols-2 gap-1 bg-white/[0.02] rounded-sm p-0.5">
              <button
                onClick={() => setTradeAction("BUY")}
                className={`py-1.5 text-[10px] font-bold rounded-sm transition-colors ${
                  tradeAction === "BUY"
                    ? "bg-bb-green/20 text-bb-green"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="trade-buy"
              >
                BUY
              </button>
              <button
                onClick={() => setTradeAction("SELL")}
                className={`py-1.5 text-[10px] font-bold rounded-sm transition-colors ${
                  tradeAction === "SELL"
                    ? "bg-bb-red/20 text-bb-red"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="trade-sell"
              >
                SELL
              </button>
            </div>

            {/* Shares / Dollars input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[9px] text-muted-foreground">{inputMode === "shares" ? "SHARES" : "AMOUNT ($)"}</label>
                <button
                  onClick={() => { setInputMode(m => m === "shares" ? "dollars" : "shares"); setShares(""); }}
                  className="text-[9px] font-bold text-bb-cyan hover:text-bb-cyan/80 transition-colors flex items-center gap-0.5"
                  data-testid="toggle-input-mode"
                >
                  <DollarSign className="w-2.5 h-2.5" />
                  {inputMode === "shares" ? "Use $" : "Use shares"}
                </button>
              </div>
              <input
                type="number"
                value={shares}
                onChange={e => setShares(e.target.value)}
                placeholder={inputMode === "shares" ? "0" : "$0.00"}
                min="0"
                step={inputMode === "shares" ? "0.0001" : "0.01"}
                className="w-full bg-[hsl(220,14%,9%)] border border-border rounded-sm px-2 py-1.5 text-xs font-mono text-foreground outline-none focus:border-bb-orange"
                data-testid="input-shares"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[9px] text-muted-foreground">
                  Max: {inputMode === "shares"
                    ? `${tradeAction === "BUY" ? maxBuyableShares.toFixed(2) : maxSellableShares % 1 === 0 ? maxSellableShares : maxSellableShares.toFixed(4)} shares`
                    : `${formatCurrency(tradeAction === "BUY" ? maxBuyableDollars : maxSellableDollars)}`
                  }
                </span>
                {shares && estimatedCost > 0 && (
                  <span className="text-[9px] text-muted-foreground">
                    {inputMode === "dollars" && estimatedShares
                      ? `≈ ${estimatedShares} shs`
                      : `≈ ${formatCurrency(estimatedCost)}`
                    }
                  </span>
                )}
              </div>
              {/* Quick-fill buttons */}
              <div className="flex gap-1 mt-1.5">
                {[25, 50, 75, 100].map(pct => {
                  let val: string;
                  if (inputMode === "shares") {
                    const max = tradeAction === "BUY" ? maxBuyableShares : maxSellableShares;
                    const computed = +(max * pct / 100).toFixed(4);
                    val = computed % 1 === 0 ? String(computed) : computed.toFixed(4);
                  } else {
                    const max = tradeAction === "BUY" ? maxBuyableDollars : maxSellableDollars;
                    val = (+(max * pct / 100).toFixed(2)).toString();
                  }
                  return (
                    <button
                      key={pct}
                      onClick={() => setShares(val)}
                      className="flex-1 py-0.5 text-[9px] font-bold text-muted-foreground bg-white/[0.03] rounded-sm hover:bg-white/[0.06] hover:text-foreground transition-colors border border-border/30"
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Execute button */}
            <button
              onClick={handleTrade}
              disabled={!shares || parseFloat(shares) <= 0}
              className={`w-full py-2 text-xs font-bold rounded-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                tradeAction === "BUY"
                  ? "bg-bb-green text-black hover:bg-bb-green/90"
                  : "bg-bb-red text-white hover:bg-bb-red/90"
              }`}
              data-testid="button-execute-trade"
            >
              {tradeAction} {selectedSymbol}
            </button>

            {/* Message */}
            {message && (
              <div className={`text-[10px] font-bold text-center py-1 rounded-sm ${
                message.type === "success" ? "text-bb-green bg-bb-green/10" : "text-bb-red bg-bb-red/10"
              }`}>
                {message.text}
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div>
            {trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <ArrowUpDown className="w-6 h-6 text-muted-foreground/30 mb-2" />
                <div className="text-[11px] text-muted-foreground">No trades yet</div>
              </div>
            ) : (
              [...trades].reverse().map(t => (
                <div key={t.id} className="px-2 py-1.5 border-b border-border/50" data-testid={`trade-${t.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-bold px-1 rounded-sm ${
                        t.action === "BUY" ? "bg-bb-green/20 text-bb-green" : "bg-bb-red/20 text-bb-red"
                      }`}>
                        {t.action}
                      </span>
                      <span className="text-[11px] font-bold text-foreground">{t.symbol}</span>
                    </div>
                    <span className="text-[11px] font-bold text-foreground">{formatCurrency(t.price * t.shares)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-muted-foreground">{t.shares % 1 === 0 ? t.shares : t.shares.toFixed(4)} shs @ ${formatPrice(t.price)}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {t.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "stats" && (
          <StatsView holdings={holdings} getStock={getStock} getHoldingPnL={getHoldingPnL} />
        )}
      </div>
    </div>
  );
}

// ─── Stats Sub-component ─────────────────────────────────────────
function StatsView({
  holdings,
  getStock,
  getHoldingPnL,
}: {
  holdings: Map<string, Holding>;
  getStock: (symbol: string) => TickerData | undefined;
  getHoldingPnL: (symbol: string) => number;
}) {
  const stats = useMemo(() => {
    const entries: { symbol: string; pnl: number; pnlPct: number; value: number }[] = [];
    holdings.forEach((h) => {
      const stock = getStock(h.symbol);
      if (!stock) return;
      const pnl = getHoldingPnL(h.symbol);
      const pnlPct = ((stock.price - h.avgCost) / h.avgCost) * 100;
      entries.push({ symbol: h.symbol, pnl, pnlPct, value: stock.price * h.shares });
    });
    // Sort for each category
    const byDollar = [...entries].sort((a, b) => b.pnl - a.pnl);
    const byPercent = [...entries].sort((a, b) => b.pnlPct - a.pnlPct);
    return {
      bestDollar: byDollar[0] ?? null,
      worstDollar: byDollar[byDollar.length - 1] ?? null,
      bestPercent: byPercent[0] ?? null,
      worstPercent: byPercent[byPercent.length - 1] ?? null,
      all: byDollar,
    };
  }, [holdings, getStock, getHoldingPnL]);

  if (holdings.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <BarChart3 className="w-6 h-6 text-muted-foreground/30 mb-2" />
        <div className="text-[11px] text-muted-foreground">No holdings to analyze</div>
        <div className="text-[10px] text-muted-foreground/60 mt-1">Buy some stocks first</div>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      {/* Best by $ */}
      <StatHighlight
        label="TOP GAINER ($)"
        icon={<TrendingUp className="w-3 h-3 text-bb-green" />}
        entry={stats.bestDollar}
        mode="dollar"
        positive
      />
      {/* Worst by $ */}
      <StatHighlight
        label="TOP LOSER ($)"
        icon={<TrendingDown className="w-3 h-3 text-bb-red" />}
        entry={stats.worstDollar}
        mode="dollar"
        positive={false}
      />
      {/* Best by % */}
      <StatHighlight
        label="TOP GAINER (%)"
        icon={<TrendingUp className="w-3 h-3 text-bb-green" />}
        entry={stats.bestPercent}
        mode="percent"
        positive
      />
      {/* Worst by % */}
      <StatHighlight
        label="TOP LOSER (%)"
        icon={<TrendingDown className="w-3 h-3 text-bb-red" />}
        entry={stats.worstPercent}
        mode="percent"
        positive={false}
      />

      {/* All holdings ranked */}
      {stats.all.length > 1 && (
        <>
          <div className="flex items-center gap-1.5 mt-2 mb-1">
            <BarChart3 className="w-3 h-3 text-muted-foreground" />
            <span className="text-[9px] font-bold text-muted-foreground tracking-wider">ALL HOLDINGS RANKED</span>
          </div>
          {stats.all.map((e, i) => (
            <div key={e.symbol} className="flex items-center justify-between px-2 py-1 border-b border-border/30">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted-foreground w-4 text-center">#{i + 1}</span>
                <span className="text-[11px] font-bold text-foreground">{e.symbol}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold tabular-nums ${e.pnl >= 0 ? "text-bb-green" : "text-bb-red"}`}>
                  {e.pnl >= 0 ? "+" : ""}{formatCurrency(e.pnl)}
                </span>
                <span className={`text-[10px] tabular-nums ${e.pnlPct >= 0 ? "text-bb-green" : "text-bb-red"}`}>
                  {e.pnlPct >= 0 ? "+" : ""}{e.pnlPct.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StatHighlight({
  label, icon, entry, mode, positive,
}: {
  label: string;
  icon: React.ReactNode;
  entry: { symbol: string; pnl: number; pnlPct: number; value: number } | null;
  mode: "dollar" | "percent";
  positive: boolean;
}) {
  if (!entry) return null;
  const color = positive ? (entry.pnl >= 0 ? "text-bb-green" : "text-bb-red") : (entry.pnl <= 0 ? "text-bb-red" : "text-bb-green");
  const bgColor = positive ? (entry.pnl >= 0 ? "bg-bb-green/[0.06]" : "bg-bb-red/[0.06]") : (entry.pnl <= 0 ? "bg-bb-red/[0.06]" : "bg-bb-green/[0.06]");
  const borderColor = positive ? (entry.pnl >= 0 ? "border-bb-green/20" : "border-bb-red/20") : (entry.pnl <= 0 ? "border-bb-red/20" : "border-bb-green/20");

  return (
    <div className={`rounded-sm border ${borderColor} ${bgColor} p-2`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[9px] font-bold text-muted-foreground tracking-wider">{label}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">{entry.symbol}</span>
        <div className="text-right">
          {mode === "dollar" ? (
            <span className={`text-xs font-bold tabular-nums ${color}`}>
              {entry.pnl >= 0 ? "+" : ""}{formatCurrency(entry.pnl)}
            </span>
          ) : (
            <span className={`text-xs font-bold tabular-nums ${color}`}>
              {entry.pnlPct >= 0 ? "+" : ""}{entry.pnlPct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
