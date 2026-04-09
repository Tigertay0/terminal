import { useState } from "react";
import { formatPrice, formatPercent, getChangeColor, formatVolume } from "@/lib/finance-api";
import type { TickerData } from "@/hooks/use-finance-data";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

type Tab = "gainers" | "losers" | "active";

interface MarketMoversProps {
  gainers: TickerData[];
  losers: TickerData[];
  active: TickerData[];
  onSelectSymbol: (symbol: string) => void;
}

export function MarketMovers({ gainers, losers, active, onSelectSymbol }: MarketMoversProps) {
  const [tab, setTab] = useState<Tab>("gainers");

  const data = tab === "gainers" ? gainers : tab === "losers" ? losers : active;

  return (
    <div className="bb-panel flex flex-col h-full" data-testid="market-movers">
      <div className="bb-panel-header">
        <div className="flex items-center gap-1">
          {([
            { key: "gainers" as Tab, label: "Gainers", icon: TrendingUp, color: "text-bb-green" },
            { key: "losers" as Tab, label: "Losers", icon: TrendingDown, color: "text-bb-red" },
            { key: "active" as Tab, label: "Active", icon: Activity, color: "text-bb-blue" },
          ]).map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1 text-2xs px-2 py-0.5 rounded-sm font-medium transition-colors ${
                tab === key
                  ? `bg-white/[0.06] ${color}`
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-tab-${key}`}
            >
              <Icon className="w-2.5 h-2.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bb-scrollbar">
        {/* Header */}
        <div className="grid grid-cols-[1fr_70px_65px_55px] gap-1 px-2 py-1 border-b border-border text-2xs text-muted-foreground sticky top-0 bg-[hsl(var(--bb-panel-bg))] z-10">
          <span>Symbol</span>
          <span className="text-right">Price</span>
          <span className="text-right">{tab === "active" ? "Volume" : "%Chg"}</span>
          <span className="text-right">Sector</span>
        </div>

        {data.slice(0, 8).map((stock, i) => {
          const changeColor = getChangeColor(stock.changesPercentage);
          return (
            <div
              key={stock.symbol}
              onClick={() => onSelectSymbol(stock.symbol)}
              className="grid grid-cols-[1fr_70px_65px_55px] gap-1 px-2 py-0.5 text-[11px] cursor-pointer hover:bg-white/[0.03] transition-colors"
              data-testid={`mover-${stock.symbol}`}
            >
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-2xs text-muted-foreground w-3 text-right shrink-0">{i + 1}</span>
                <span className="font-bold truncate">{stock.symbol}</span>
              </div>
              <span className="text-right tabular-nums">{formatPrice(stock.price)}</span>
              <span className={`text-right tabular-nums ${tab === "active" ? "text-bb-blue" : changeColor}`}>
                {tab === "active" ? formatVolume(stock.volume) : formatPercent(stock.changesPercentage)}
              </span>

            </div>
          );
        })}
      </div>
    </div>
  );
}
