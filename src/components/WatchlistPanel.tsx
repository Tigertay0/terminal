import { formatPrice, formatChange, formatPercent, getChangeColor, formatVolume } from "@/lib/finance-api";
import type { TickerData } from "@/hooks/use-finance-data";
import { TrendingUp, TrendingDown, Minus, X } from "lucide-react";

interface WatchlistPanelProps {
  symbols: string[];
  getStock: (symbol: string) => TickerData | undefined;
  onSelectSymbol: (symbol: string) => void;
  selectedSymbol: string;
  onRemoveSymbol?: (symbol: string) => void;
}

export function WatchlistPanel({
  symbols,
  getStock,
  onSelectSymbol,
  selectedSymbol,
  onRemoveSymbol,
}: WatchlistPanelProps) {
  return (
    <div className="bb-panel flex flex-col h-full" data-testid="watchlist-panel">
      <div className="bb-panel-header">
        <span className="text-2xs font-bold text-bb-orange tracking-wider uppercase">Watchlist</span>
        <span className="text-2xs text-muted-foreground">{symbols.length} items</span>
      </div>
      <div className="flex-1 overflow-y-auto bb-scrollbar">
        {/* Header row */}
        <div className="grid grid-cols-[60px_58px_50px_54px] gap-1 px-2 py-1 border-b border-border text-2xs text-muted-foreground sticky top-0 bg-[hsl(var(--bb-panel-bg))] z-10">
          <span>Symbol</span>
          <span className="text-right">Price</span>
          <span className="text-right">Chg</span>
          <span className="text-right">%Chg</span>
        </div>
        {symbols.map(sym => {
          const stock = getStock(sym);
          if (!stock) return (
            <div key={sym} className="grid grid-cols-[60px_58px_50px_54px] gap-1 px-2 py-0.5 text-2xs text-muted-foreground">
              <span className="font-bold">{sym}</span>
              <span className="text-right">—</span>
              <span className="text-right">—</span>
              <span className="text-right">—</span>
            </div>
          );

          const isSelected = sym === selectedSymbol;
          const changeColor = getChangeColor(stock.change);

          return (
            <div
              key={sym}
              onClick={() => onSelectSymbol(sym)}
              className={`grid grid-cols-[60px_58px_50px_54px] gap-1 px-2 py-0.5 text-[11px] cursor-pointer transition-colors group ${
                isSelected
                  ? "bg-bb-orange/10 border-l-2 border-l-bb-orange"
                  : "hover:bg-white/[0.03] border-l-2 border-l-transparent"
              }`}
              data-testid={`watchlist-item-${sym}`}
            >
              <div className="flex items-center gap-1 min-w-0">
                {stock.change > 0 ? (
                  <TrendingUp className="w-2.5 h-2.5 text-bb-green shrink-0" />
                ) : stock.change < 0 ? (
                  <TrendingDown className="w-2.5 h-2.5 text-bb-red shrink-0" />
                ) : (
                  <Minus className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                )}
                <span className="font-bold text-foreground truncate">{sym}</span>
                {onRemoveSymbol && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveSymbol(sym); }}
                    className="opacity-0 group-hover:opacity-100 ml-auto"
                    data-testid={`button-remove-${sym}`}
                  >
                    <X className="w-2.5 h-2.5 text-muted-foreground hover:text-bb-red" />
                  </button>
                )}
              </div>
              <span className="text-right font-medium tabular-nums">{formatPrice(stock.price)}</span>
              <span className={`text-right tabular-nums ${changeColor}`}>
                {formatChange(stock.change)}
              </span>
              <span className={`text-right tabular-nums ${changeColor}`}>
                {formatPercent(stock.changesPercentage)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
