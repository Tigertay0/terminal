import { useState } from "react";
import { formatPrice, formatPercent, getChangeColor, formatVolume } from "@/lib/finance-api";
import type { TickerData } from "@/hooks/use-finance-data";

type Tab = "gainers" | "losers" | "active";

interface MarketMoversProps {
  gainers: TickerData[];
  losers: TickerData[];
  active: TickerData[];
  onSelectSymbol: (symbol: string) => void;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
  { key: "active", label: "Most active" },
];

const ROW = "grid grid-cols-[24px_minmax(0,1fr)_80px_72px] items-center gap-2 h-8 px-3";

export function MarketMovers({ gainers, losers, active, onSelectSymbol }: MarketMoversProps) {
  const [tab, setTab] = useState<Tab>("gainers");
  const data = tab === "gainers" ? gainers : tab === "losers" ? losers : active;

  return (
    <div className="rf-panel h-full" data-testid="market-movers">
      <div className="rf-panel-header px-1" role="tablist" aria-label="Movers list">
        <div className="flex h-full">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`px-3 text-xs font-medium transition-colors ${
                tab === key ? "text-foreground rf-marker-b" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-tab-${key}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rf-scrollbar">
        <div className={`${ROW} h-7 text-2xs text-muted-foreground sticky top-0 bg-card z-10 border-b border-border`}>
          <span className="text-right">#</span>
          <span>Symbol</span>
          <span className="text-right">Last</span>
          <span className="text-right">{tab === "active" ? "Volume" : "Chg %"}</span>
        </div>

        {data.slice(0, 8).map((stock, i) => (
          <button
            key={stock.symbol}
            onClick={() => onSelectSymbol(stock.symbol)}
            className={`${ROW} w-full text-left text-xs hover:bg-raised/60 transition-colors`}
            data-testid={`mover-${stock.symbol}`}
          >
            <span className="num text-2xs text-muted-foreground text-right">{i + 1}</span>
            <span className="num font-medium text-foreground truncate">{stock.symbol}</span>
            <span className="num text-right text-foreground">{formatPrice(stock.price)}</span>
            <span className={`num text-right ${tab === "active" ? "text-dim" : getChangeColor(stock.changesPercentage)}`}>
              {tab === "active" ? formatVolume(stock.volume) : formatPercent(stock.changesPercentage)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
