import { useEffect, useRef } from "react";
import type { TradeRecord, Holding } from "@/hooks/use-simulation";
import type { TickerData } from "@/hooks/use-finance-data";
import type { EventDefinition } from "@/lib/events";
import { formatWholeDollars as formatCurrency } from "@/lib/finance-api";
import { useFocusTrap } from "@/hooks/use-focus-trap";

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

/** One line of the tear sheet: label on the left, figure and a note on the right. */
function SheetRow({ label, value, note, tone = "text-foreground" }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 h-9 border-b border-border/60 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right">
        <span className={`num text-xs ${tone}`}>{value}</span>
        {note && <span className="text-xs text-muted-foreground ml-2">{note}</span>}
      </dd>
    </div>
  );
}

const signed = (n: number) => `${n >= 0 ? "+" : ""}${formatCurrency(n)}`;

/** The event result, laid out like a printed tear sheet. */
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

  // ─── Compute the recap ────────────────────────────────────────
  // Best & worst traded stock
  const stockPnL = new Map<string, number>();
  for (const trade of trades) {
    const current = stockPnL.get(trade.symbol) ?? 0;
    const amount = trade.price * trade.shares;
    stockPnL.set(trade.symbol, trade.action === "SELL" ? current + amount : current - amount);
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
  const biggestTrade = trades.length > 0
    ? trades.reduce((max, t) => (t.price * t.shares > max.price * max.shares ? t : max), trades[0])
    : null;

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onViewLeaderboard(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onViewLeaderboard]);

  const buys = trades.filter(t => t.action === "BUY").length;
  const sells = trades.length - buys;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" data-testid="event-complete">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="event-complete-title" className="w-full max-w-md max-h-[90vh] overflow-y-auto rf-scrollbar rounded-lg border border-border bg-popover shadow-xl rise-in">
        <div className="px-6 pt-6 pb-5 border-b border-border">
          <p className="text-xs text-muted-foreground">Event finished · {event.name}</p>
          <h2 id="event-complete-title" className={`num text-4xl mt-3 leading-none ${isPositive ? "text-up" : "text-down"}`}>
            {signed(profit)}
          </h2>
          <p className="text-xs text-dim mt-2">
            <span className="num">{isPositive ? "+" : ""}{profitPct}%</span> on a <span className="num">{formatCurrency(event.startingCash)}</span> start
          </p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
          <div className="px-4 py-4">
            <div className="text-2xs text-muted-foreground">Rank</div>
            <div className="num text-lg text-foreground mt-1">{leaderboardRank > 0 ? `#${leaderboardRank}` : "—"}</div>
            <div className="text-2xs text-muted-foreground mt-1">of <span className="num">{totalParticipants}</span> players</div>
          </div>
          <div className="px-4 py-4">
            <div className="text-2xs text-muted-foreground">Final value</div>
            <div className="num text-lg text-foreground mt-1">{formatCurrency(portfolioValue)}</div>
          </div>
          <div className="px-4 py-4">
            <div className="text-2xs text-muted-foreground">Days played</div>
            <div className="num text-lg text-foreground mt-1">{dayNumber}</div>
            <div className="text-2xs text-muted-foreground mt-1">of <span className="num">{event.durationDays}</span></div>
          </div>
        </div>

        <dl className="px-6 py-3 border-b border-border">
          <SheetRow
            label="Best stock"
            value={bestStock.symbol}
            note={bestStock.pnl !== 0 ? signed(bestStock.pnl) : "no gains"}
            tone={bestStock.pnl > 0 ? "text-up" : "text-foreground"}
          />
          <SheetRow
            label="Worst stock"
            value={worstStock.symbol}
            note={worstStock.pnl !== 0 ? formatCurrency(worstStock.pnl) : "no losses"}
            tone={worstStock.pnl < 0 ? "text-down" : "text-foreground"}
          />
          <SheetRow
            label="Best day"
            value={bestDay.gain > 0 ? `Day ${bestDay.day}` : "—"}
            note={bestDay.gain > 0 ? signed(bestDay.gain) : undefined}
          />
          <SheetRow label="Trades" value={`${trades.length}`} note={`${buys} buys, ${sells} sells`} />
          {biggestTrade && (
            <SheetRow
              label="Biggest trade"
              value={`${biggestTrade.action === "BUY" ? "Buy" : "Sell"} ${biggestTrade.symbol}`}
              note={`${biggestTrade.shares} × $${biggestTrade.price.toFixed(2)}`}
            />
          )}
          <SheetRow
            label="Cash left"
            value={formatCurrency(finalCash)}
            note={portfolioValue > 0 ? `${((finalCash / portfolioValue) * 100).toFixed(0)}% of portfolio` : undefined}
          />
        </dl>

        {event.prize && (
          <p className="px-6 py-3 text-xs text-dim border-b border-border">{event.prize}</p>
        )}

        <div className="px-6 py-4 flex items-center gap-2">
          <button
            onClick={onViewLeaderboard}
            autoFocus
            className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-[background-color,transform]"
            data-testid="view-leaderboard-btn"
          >
            View leaderboard
          </button>
          <button
            onClick={onGoHome}
            className="h-10 px-4 rounded-md text-sm text-dim hover:text-foreground hover:bg-raised transition-colors"
            data-testid="go-home-btn"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
