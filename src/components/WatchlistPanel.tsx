import { formatPrice, formatChange, formatPercent, getChangeColor } from "@/lib/finance-api";
import type { TickerData } from "@/hooks/use-finance-data";
import { X } from "lucide-react";

interface WatchlistPanelProps {
  symbols: string[];
  getStock: (symbol: string) => TickerData | undefined;
  onSelectSymbol: (symbol: string) => void;
  selectedSymbol: string;
  onRemoveSymbol?: (symbol: string) => void;
}

const ROW = "grid grid-cols-[minmax(0,1fr)_68px_52px_56px] items-center gap-2 h-8 px-3";

export function WatchlistPanel({
  symbols,
  getStock,
  onSelectSymbol,
  selectedSymbol,
  onRemoveSymbol,
}: WatchlistPanelProps) {
  return (
    <div className="rf-panel h-full" data-testid="watchlist-panel">
      <div className="rf-panel-header">
        <span className="rf-panel-title">Watchlist</span>
        <span className="num text-2xs text-muted-foreground">{symbols.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto rf-scrollbar" data-testid="watchlist">
        <div className={`${ROW} h-7 text-2xs text-muted-foreground sticky top-0 bg-card z-10 border-b border-border`}>
          <span>Symbol</span>
          <span className="text-right">Last</span>
          <span className="text-right">Chg</span>
          <span className="text-right">Chg %</span>
        </div>
        {symbols.map(sym => {
          const stock = getStock(sym);
          if (!stock) return (
            <div key={sym} className={`${ROW} text-xs text-muted-foreground`}>
              <span className="num">{sym}</span>
              <span className="num text-right">—</span>
              <span className="num text-right">—</span>
              <span className="num text-right">—</span>
            </div>
          );

          const isSelected = sym === selectedSymbol;
          const changeColor = getChangeColor(stock.change);

          return (
            <div
              key={sym}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => onSelectSymbol(sym)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectSymbol(sym); } }}
              className={`${ROW} text-xs cursor-pointer transition-colors group ${
                isSelected ? "bg-raised rf-marker" : "hover:bg-raised/60"
              }`}
              data-testid={`watchlist-item-${sym}`}
            >
              <span className="flex items-center gap-1 min-w-0">
                <span className="num font-medium text-foreground truncate">{sym}</span>
                {onRemoveSymbol && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveSymbol(sym); }}
                    className="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                    aria-label={`Remove ${sym}`}
                    data-testid={`button-remove-${sym}`}
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                )}
              </span>
              <span className="num text-right text-foreground">{formatPrice(stock.price)}</span>
              <span className={`num text-right ${changeColor}`}>{formatChange(stock.change)}</span>
              <span className={`num text-right ${changeColor}`}>{formatPercent(stock.changesPercentage)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
