import type { TickerData } from "@/hooks/use-finance-data";
import { formatPercent, getChangeColor } from "@/lib/finance-api";

interface SectorHeatmapProps {
  stocks: TickerData[];
  onSelectSymbol: (symbol: string) => void;
}

const SECTORS = ["Technology", "Finance", "Healthcare", "Energy", "Consumer"];

// Quotes carry Yahoo sector names ("Financial Services", "Consumer Cyclical"...); bucket them into the map's groups
function sectorGroup(sector: string): string {
  if (sector.startsWith("Financial")) return "Finance";
  if (sector.startsWith("Consumer")) return "Consumer";
  return sector;
}

/** Tile tint grows with the size of the move: up in green, down in red, at most 3%. */
function heatStyle(pct: number): React.CSSProperties {
  const strength = Math.min(Math.abs(pct) / 3, 1);
  const alpha = 0.08 + strength * 0.32;
  const hue = pct >= 0 ? "var(--up)" : "var(--down)";
  return { backgroundColor: `hsl(${hue} / ${alpha.toFixed(2)})` };
}

export function SectorHeatmap({ stocks, onSelectSymbol }: SectorHeatmapProps) {
  const sectorGroups = SECTORS.map(sector => ({
    name: sector,
    stocks: stocks.filter(s => sectorGroup(s.sector) === sector),
  }));

  return (
    <div className="rf-panel h-full" data-testid="sector-heatmap">
      <div className="rf-panel-header">
        <span className="rf-panel-title">Sectors</span>
        <span className="text-2xs text-muted-foreground">Average change today</span>
      </div>
      <div className="flex-1 overflow-y-auto rf-scrollbar px-3 py-3 space-y-4">
        {sectorGroups.map(group => {
          const avgChg = group.stocks.length > 0
            ? group.stocks.reduce((s, st) => s + st.changesPercentage, 0) / group.stocks.length
            : 0;

          return (
            <div key={group.name} className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-dim">{group.name}</span>
                <span className={`num ${getChangeColor(avgChg)}`}>{formatPercent(avgChg)}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {group.stocks.map(stock => (
                  <button
                    key={stock.symbol}
                    onClick={() => onSelectSymbol(stock.symbol)}
                    style={heatStyle(stock.changesPercentage)}
                    className="min-w-14 px-2 py-1 rounded-md text-left hover:ring-1 hover:ring-foreground/30 transition-shadow"
                    title={`${stock.symbol}: ${formatPercent(stock.changesPercentage)}`}
                    data-testid={`heat-${stock.symbol}`}
                  >
                    <div className="num text-2xs font-medium text-foreground">{stock.symbol}</div>
                    <div className="num text-2xs text-dim">{formatPercent(stock.changesPercentage)}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
