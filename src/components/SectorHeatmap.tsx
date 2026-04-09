import type { TickerData } from "@/hooks/use-finance-data";
import { formatPercent, getChangeColor } from "@/lib/finance-api";

interface SectorHeatmapProps {
  stocks: TickerData[];
  onSelectSymbol: (symbol: string) => void;
}

const SECTORS = ["Technology", "Finance", "Healthcare", "Energy", "Consumer"];

export function SectorHeatmap({ stocks, onSelectSymbol }: SectorHeatmapProps) {
  const sectorGroups = SECTORS.map(sector => ({
    name: sector,
    stocks: stocks.filter(s => s.sector === sector),
  }));

  const getHeatColor = (pct: number) => {
    if (pct > 2) return "bg-[hsl(142,76%,20%)]";
    if (pct > 1) return "bg-[hsl(142,76%,16%)]";
    if (pct > 0.5) return "bg-[hsl(142,76%,13%)]";
    if (pct > 0) return "bg-[hsl(142,76%,10%)]";
    if (pct > -0.5) return "bg-[hsl(0,72%,12%)]";
    if (pct > -1) return "bg-[hsl(0,72%,15%)]";
    if (pct > -2) return "bg-[hsl(0,72%,19%)]";
    return "bg-[hsl(0,72%,24%)]";
  };

  return (
    <div className="bb-panel flex flex-col h-full" data-testid="sector-heatmap">
      <div className="bb-panel-header">
        <span className="text-2xs font-bold text-bb-orange tracking-wider uppercase">Sector Map</span>
      </div>
      <div className="flex-1 overflow-y-auto bb-scrollbar p-1.5 space-y-1.5">
        {sectorGroups.map(group => {
          const avgChg = group.stocks.length > 0
            ? group.stocks.reduce((s, st) => s + st.changesPercentage, 0) / group.stocks.length
            : 0;
          const changeColor = getChangeColor(avgChg);

          return (
            <div key={group.name}>
              <div className="flex items-center justify-between px-1 mb-0.5">
                <span className="text-2xs font-bold text-foreground">{group.name}</span>
                <span className={`text-2xs tabular-nums ${changeColor}`}>{formatPercent(avgChg)}</span>
              </div>
              <div className="flex flex-wrap gap-0.5">
                {group.stocks.map(stock => (
                  <div
                    key={stock.symbol}
                    onClick={() => onSelectSymbol(stock.symbol)}
                    className={`${getHeatColor(stock.changesPercentage)} px-1.5 py-0.5 rounded-sm cursor-pointer hover:ring-1 hover:ring-bb-orange/30 transition-all`}
                    title={`${stock.symbol}: ${formatPercent(stock.changesPercentage)}`}
                    data-testid={`heat-${stock.symbol}`}
                  >
                    <div className="text-[9px] font-bold text-foreground">{stock.symbol}</div>
                    <div className={`text-[8px] tabular-nums ${getChangeColor(stock.changesPercentage)}`}>
                      {formatPercent(stock.changesPercentage)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
