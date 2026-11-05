import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { TickerData } from "@/hooks/use-finance-data";
import type { Holding, TradeRecord } from "@/hooks/use-simulation";
import { formatPrice, formatCurrency } from "@/lib/finance-api";

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

const TABS: { key: Tab; label: string }[] = [
  { key: "portfolio", label: "Portfolio" },
  { key: "trade", label: "Trade" },
  { key: "history", label: "History" },
  { key: "stats", label: "Stats" },
];

const EMPTY_STATE = "px-3 py-6 text-xs text-muted-foreground";
const INPUT_CLASS =
  "w-full h-8 rounded-md bg-raised border border-border px-2 text-xs num text-foreground outline-none focus:border-ink/60";

const pnlColor = (value: number) => (value >= 0 ? "text-up" : "text-down");
const signed = (value: number) => (value >= 0 ? "+" : "");

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
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(messageTimeoutRef.current), []);

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
    // Restart the timer so an earlier trade's timeout doesn't clear this message early
    clearTimeout(messageTimeoutRef.current);
    messageTimeoutRef.current = setTimeout(() => setMessage(null), 2500);
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
    <div className="rf-panel flex flex-col h-full" data-testid="portfolio-panel">
      {/* Header with KPIs */}
      <div className="rf-panel-header justify-between">
        <span className="rf-panel-title">Portfolio</span>
        <span className="text-xs">
          <span className={`num ${pnlColor(totalPnL)}`}>
            {signed(totalPnL)}{formatCurrency(totalPnL)} ({signed(totalPnLPct)}{totalPnLPct.toFixed(2)}%)
          </span>
          <span className="text-muted-foreground"> vs start</span>
        </span>
      </div>
      <div className="flex items-end justify-between gap-4 px-3 py-3 border-b border-border shrink-0">
        <div className="min-w-0">
          <div className="text-2xs text-muted-foreground">Total value</div>
          <div className="num text-xl text-foreground leading-tight mt-1 truncate">{formatCurrency(portfolioValue)}</div>
        </div>
        <dl className="text-xs space-y-1 shrink-0">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Cash</dt>
            <dd className="num text-dim">{formatCurrency(cash)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Invested</dt>
            <dd className="num text-dim">{formatCurrency(portfolioValue - cash)}</dd>
          </div>
        </dl>
      </div>

      {/* Tabs */}
      <div className="flex h-9 border-b border-border shrink-0 px-1" role="tablist" aria-label="Portfolio views">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-3 text-xs font-medium transition-colors ${
              tab === key ? "text-foreground rf-marker-b" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto rf-scrollbar">
        {tab === "portfolio" && (
          <div>
            {holdings.size === 0 ? (
              <div className={EMPTY_STATE}>No holdings yet. Pick a symbol, then buy it from the Trade tab</div>
            ) : (
              Array.from(holdings.values()).map(h => {
                const stock = getStock(h.symbol);
                if (!stock) return null;
                const pnl = getHoldingPnL(h.symbol);
                const pnlPct = ((stock.price - h.avgCost) / h.avgCost * 100);
                const selected = selectedSymbol === h.symbol;
                return (
                  <div
                    key={h.symbol}
                    className={`px-3 py-2 border-b border-border/50 cursor-pointer hover:bg-raised/60 transition-colors ${
                      selected ? "bg-raised rf-marker" : ""
                    }`}
                    onClick={() => onSelectSymbol(h.symbol)}
                    data-testid={`holding-${h.symbol}`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-baseline gap-2">
                        <span className="num font-medium text-foreground">{h.symbol}</span>
                        <span className="num text-2xs text-muted-foreground">{h.shares % 1 === 0 ? h.shares : h.shares.toFixed(4)} shares</span>
                      </div>
                      <div className="text-right">
                        <div className="num text-foreground">{formatCurrency(stock.price * h.shares)}</div>
                        <div className={`num ${pnlColor(pnl)}`}>
                          {signed(pnl)}{formatCurrency(pnl)} ({signed(pnlPct)}{pnlPct.toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-2xs text-muted-foreground">
                      <span>Avg <span className="num">${formatPrice(h.avgCost)}</span></span>
                      <span>Last <span className="num">${formatPrice(stock.price)}</span></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "trade" && (
          <div className="p-3 space-y-3">
            {/* Stock info */}
            {currentStock && (
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="num font-medium text-foreground">{selectedSymbol}</span>
                  <span className="num text-foreground">${formatPrice(currentStock.price)}</span>
                </div>
                <div className="text-2xs text-dim mt-1">{currentStock.name}</div>
              </div>
            )}

            {/* Buy/Sell toggle */}
            <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-0.5">
              <button
                onClick={() => setTradeAction("BUY")}
                className={`h-7 text-xs rounded transition-colors ${
                  tradeAction === "BUY"
                    ? "bg-raised text-up font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="trade-buy"
              >
                Buy
              </button>
              <button
                onClick={() => setTradeAction("SELL")}
                className={`h-7 text-xs rounded transition-colors ${
                  tradeAction === "SELL"
                    ? "bg-raised text-down font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="trade-sell"
              >
                Sell
              </button>
            </div>

            {/* Shares / Dollars input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-2xs text-muted-foreground">{inputMode === "shares" ? "Shares" : "Amount ($)"}</label>
                <button
                  onClick={() => { setInputMode(m => m === "shares" ? "dollars" : "shares"); setShares(""); }}
                  className="text-2xs text-dim hover:text-foreground transition-colors"
                  data-testid="toggle-input-mode"
                >
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
                className={INPUT_CLASS}
                data-testid="input-shares"
              />
              <div className="flex items-center justify-between mt-1 text-2xs text-muted-foreground">
                <span>
                  Max <span className="num">{inputMode === "shares"
                    ? `${tradeAction === "BUY" ? maxBuyableShares.toFixed(2) : maxSellableShares % 1 === 0 ? maxSellableShares : maxSellableShares.toFixed(4)} shares`
                    : `${formatCurrency(tradeAction === "BUY" ? maxBuyableDollars : maxSellableDollars)}`
                  }</span>
                </span>
                {shares && estimatedCost > 0 && (
                  <span className="num">
                    {inputMode === "dollars" && estimatedShares
                      ? `≈ ${estimatedShares} shs`
                      : `≈ ${formatCurrency(estimatedCost)}`
                    }
                  </span>
                )}
              </div>
              {/* Quick-fill buttons */}
              <div className="flex gap-1 mt-2">
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
                      className="flex-1 h-7 rounded-md num text-xs text-dim hover:bg-raised hover:text-foreground transition-colors"
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
              className="w-full h-8 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-execute-trade"
            >
              {tradeAction === "BUY" ? "Buy" : "Sell"} {selectedSymbol}
            </button>

            {/* Message */}
            {message && (
              <div className={`text-xs text-center ${message.type === "success" ? "text-up" : "text-down"}`}>
                {message.text}
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div>
            {trades.length === 0 ? (
              <div className={EMPTY_STATE}>No trades yet</div>
            ) : (
              [...trades].reverse().map(t => (
                <div key={t.id} className="px-3 py-2 border-b border-border/50" data-testid={`trade-${t.id}`}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-baseline gap-2">
                      <span className={t.action === "BUY" ? "text-up" : "text-down"}>
                        {t.action === "BUY" ? "Buy" : "Sell"}
                      </span>
                      <span className="num font-medium text-foreground">{t.symbol}</span>
                    </div>
                    <span className="num text-foreground">{formatCurrency(t.price * t.shares)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-2xs text-muted-foreground num">
                    <span>{t.shares % 1 === 0 ? t.shares : t.shares.toFixed(4)} shares @ ${formatPrice(t.price)}</span>
                    <span>
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
interface StatEntry {
  symbol: string;
  pnl: number;
  pnlPct: number;
  value: number;
}

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
    const entries: StatEntry[] = [];
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
    return <div className={EMPTY_STATE}>No holdings to analyze. Buy a stock from the Trade tab first</div>;
  }

  return (
    <div className="p-3 space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <StatHighlight label="Top gainer ($)" entry={stats.bestDollar} mode="dollar" />
        <StatHighlight label="Top loser ($)" entry={stats.worstDollar} mode="dollar" />
        <StatHighlight label="Top gainer (%)" entry={stats.bestPercent} mode="percent" />
        <StatHighlight label="Top loser (%)" entry={stats.worstPercent} mode="percent" />
      </div>

      {/* All holdings ranked */}
      {stats.all.length > 1 && (
        <div>
          <div className="flex items-center h-7 text-2xs text-muted-foreground border-b border-border">
            All holdings ranked
          </div>
          {stats.all.map((e, i) => (
            <div key={e.symbol} className="flex items-center justify-between h-8 text-xs border-b border-border/50">
              <div className="flex items-center gap-2">
                <span className="num text-2xs text-muted-foreground w-5 text-right">{i + 1}</span>
                <span className="num font-medium text-foreground">{e.symbol}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`num ${pnlColor(e.pnl)}`}>
                  {signed(e.pnl)}{formatCurrency(e.pnl)}
                </span>
                <span className={`num w-14 text-right ${pnlColor(e.pnlPct)}`}>
                  {signed(e.pnlPct)}{e.pnlPct.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatHighlight({
  label, entry, mode,
}: {
  label: string;
  entry: StatEntry | null;
  mode: "dollar" | "percent";
}) {
  if (!entry) return null;
  const value = mode === "dollar" ? entry.pnl : entry.pnlPct;
  const text = mode === "dollar"
    ? `${signed(entry.pnl)}${formatCurrency(entry.pnl)}`
    : `${signed(entry.pnlPct)}${entry.pnlPct.toFixed(2)}%`;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-2xs text-muted-foreground">{label}</div>
      <div className={`num text-sm mt-1 ${pnlColor(value)}`}>{text}</div>
      <div className="num text-2xs text-dim mt-1">{entry.symbol}</div>
    </div>
  );
}
