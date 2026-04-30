import { Trophy, TrendingUp, TrendingDown, BarChart3, Calendar, DollarSign, Target, ArrowRight, Star } from "lucide-react";
import type { TradeRecord, Holding } from "@/hooks/use-simulation";
import type { TickerData } from "@/hooks/use-finance-data";
import type { EventDefinition } from "@/lib/events";

interface EventCompleteProps {
  event: EventDefinition;
  finalCash: number;
  holdings: Map<string, Holding>;
  trades: TradeRecord[];
  dayNumber: number;
  getStock: (sym: string) => TickerData | undefined;
  portfolioValue: number;
  leaderboardRank: number;
  totalParticipants: number;
  dailySnapshots: number[];
  onViewLeaderboard: () => void;
  onGoHome: () => void;
}

function formatCurrency(val: number): string {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color?: string;
}

function StatCard({ icon, label, value, subValue, color = "text-foreground" }: StatCardProps) {
  return (
    <div className="bg-white/[0.03] border border-border/50 rounded-sm p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[9px] font-bold text-muted-foreground tracking-wider">{label}</span>
      </div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      {subValue && <div className="text-[10px] text-muted-foreground mt-0.5">{subValue}</div>}
    </div>
  );
}

export function EventComplete({
  event,
  finalCash,
  holdings,
  trades,
  dayNumber,
  getStock,
  portfolioValue,
  leaderboardRank,
  totalParticipants,
  dailySnapshots,
  onViewLeaderboard,
  onGoHome,
}: EventCompleteProps) {
  const profit = portfolioValue - event.startingCash;
  const profitPct = ((profit / event.startingCash) * 100).toFixed(1);
  const isPositive = profit >= 0;

  // ─── Compute achievements ─────────────────────────────────────
  // Best & worst traded stock
  const stockPnL = new Map<string, number>();
  for (const trade of trades) {
    if (trade.action === "SELL") {
      // Find matching buys to estimate PnL
      const current = stockPnL.get(trade.symbol) ?? 0;
      stockPnL.set(trade.symbol, current + trade.price * trade.shares);
    } else {
      const current = stockPnL.get(trade.symbol) ?? 0;
      stockPnL.set(trade.symbol, current - trade.price * trade.shares);
    }
  }
  // Also account for unrealized gains
  for (const [sym, holding] of holdings) {
    const stock = getStock(sym);
    if (stock) {
      const current = stockPnL.get(sym) ?? 0;
      stockPnL.set(sym, current + stock.price * holding.shares);
    }
  }

  let bestStock = { symbol: "—", pnl: 0 };
  let worstStock = { symbol: "—", pnl: 0 };
  for (const [sym, pnl] of stockPnL) {
    if (pnl > bestStock.pnl) bestStock = { symbol: sym, pnl };
    if (pnl < worstStock.pnl) worstStock = { symbol: sym, pnl };
  }

  // Best trading day (biggest daily gain)
  let bestDay = { day: 0, gain: 0 };
  for (let i = 1; i < dailySnapshots.length; i++) {
    const gain = dailySnapshots[i] - dailySnapshots[i - 1];
    if (gain > bestDay.gain) {
      bestDay = { day: i + 1, gain };
    }
  }

  // Biggest single trade
  let biggestTrade = trades.length > 0
    ? trades.reduce((max, t) => (t.price * t.shares > max.price * max.shares ? t : max), trades[0])
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" data-testid="event-complete">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-bb-cyan/40"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out ${Math.random() * 2}s infinite alternate`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-sm border border-bb-cyan/30 bg-background shadow-2xl shadow-bb-cyan/10">
        {/* Header */}
        <div className="relative px-6 pt-8 pb-6 text-center border-b border-border bg-gradient-to-b from-bb-cyan/[0.08] to-transparent">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bb-cyan/10 border-2 border-bb-cyan/30 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-bb-cyan" />
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-wide mb-1">EVENT COMPLETE</h2>
          <p className="text-xs text-muted-foreground">{event.name}</p>

          {/* Final Profit */}
          <div className="mt-4 bg-white/[0.03] border border-border/50 rounded-sm p-3 inline-block">
            <div className="text-[9px] text-muted-foreground tracking-wider mb-1">FINAL PROFIT/LOSS</div>
            <div className={`text-2xl font-bold tabular-nums ${isPositive ? "text-bb-green" : "text-bb-red"}`}>
              {isPositive ? "+" : ""}{formatCurrency(profit)}
            </div>
            <div className={`text-xs ${isPositive ? "text-bb-green/70" : "text-bb-red/70"}`}>
              {isPositive ? "+" : ""}{profitPct}% return
            </div>
          </div>
        </div>

        {/* Rank */}
        <div className="px-6 py-4 border-b border-border bg-white/[0.01]">
          <div className="flex items-center justify-center gap-3">
            <div className="text-center">
              <div className="text-[9px] text-muted-foreground tracking-wider">YOUR RANK</div>
              <div className="text-2xl font-bold text-bb-cyan">
                #{leaderboardRank}
              </div>
              <div className="text-[10px] text-muted-foreground">of {totalParticipants} players</div>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-center">
              <div className="text-[9px] text-muted-foreground tracking-wider">FINAL VALUE</div>
              <div className="text-lg font-bold text-foreground">{formatCurrency(portfolioValue)}</div>
              <div className="text-[10px] text-muted-foreground">from {formatCurrency(event.startingCash)}</div>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-center">
              <div className="text-[9px] text-muted-foreground tracking-wider">DAYS PLAYED</div>
              <div className="text-lg font-bold text-foreground">{dayNumber}</div>
              <div className="text-[10px] text-muted-foreground">of {event.durationDays}</div>
            </div>
          </div>
        </div>

        {/* Achievements Grid */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-1.5 mb-3">
            <Star className="w-3.5 h-3.5 text-bb-orange" />
            <span className="text-[10px] font-bold text-bb-orange tracking-wider">ACHIEVEMENTS & RECAP</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={<TrendingUp className="w-3 h-3 text-bb-green" />}
              label="BEST STOCK"
              value={bestStock.symbol}
              subValue={bestStock.pnl !== 0 ? `${bestStock.pnl >= 0 ? "+" : ""}${formatCurrency(bestStock.pnl)}` : "No trades"}
              color="text-bb-green"
            />
            <StatCard
              icon={<TrendingDown className="w-3 h-3 text-bb-red" />}
              label="WORST STOCK"
              value={worstStock.symbol}
              subValue={worstStock.pnl !== 0 ? `${formatCurrency(worstStock.pnl)}` : "No losses"}
              color="text-bb-red"
            />
            <StatCard
              icon={<Calendar className="w-3 h-3 text-bb-cyan" />}
              label="BEST TRADING DAY"
              value={bestDay.gain > 0 ? `Day ${bestDay.day}` : "—"}
              subValue={bestDay.gain > 0 ? `+${formatCurrency(bestDay.gain)} gain` : "No standout day"}
              color="text-bb-cyan"
            />
            <StatCard
              icon={<BarChart3 className="w-3 h-3 text-bb-orange" />}
              label="TOTAL TRADES"
              value={`${trades.length}`}
              subValue={`${trades.filter(t => t.action === "BUY").length} buys, ${trades.filter(t => t.action === "SELL").length} sells`}
            />
            {biggestTrade && (
              <StatCard
                icon={<DollarSign className="w-3 h-3 text-foreground" />}
                label="BIGGEST TRADE"
                value={`${biggestTrade.action} ${biggestTrade.symbol}`}
                subValue={`${biggestTrade.shares} shares × $${biggestTrade.price.toFixed(2)} = ${formatCurrency(biggestTrade.shares * biggestTrade.price)}`}
              />
            )}
            <StatCard
              icon={<Target className="w-3 h-3 text-foreground" />}
              label="CASH REMAINING"
              value={formatCurrency(finalCash)}
              subValue={`${((finalCash / portfolioValue) * 100).toFixed(0)}% of portfolio`}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 space-y-2">
          <button
            onClick={onViewLeaderboard}
            className="w-full py-2.5 bg-bb-cyan text-black font-bold text-sm rounded-sm hover:bg-bb-cyan/90 transition-colors flex items-center justify-center gap-2"
            data-testid="view-leaderboard-btn"
          >
            <Trophy className="w-4 h-4" />
            VIEW LEADERBOARD
          </button>
          <button
            onClick={onGoHome}
            className="w-full py-2 text-muted-foreground text-xs hover:text-foreground transition-colors flex items-center justify-center gap-1"
            data-testid="go-home-btn"
          >
            Back to Home
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes float {
          from { transform: translateY(0px) scale(1); opacity: 0.4; }
          to { transform: translateY(-30px) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
