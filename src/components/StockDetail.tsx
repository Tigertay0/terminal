import { formatPrice, formatChange, formatPercent, getChangeColor, formatNumber, formatVolume } from "@/lib/finance-api";
import type { TickerData } from "@/hooks/use-finance-data";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface StockDetailProps {
  stock: TickerData | undefined;
}

export function StockDetail({ stock }: StockDetailProps) {
  if (!stock) {
    return (
      <div className="bb-panel flex flex-col h-full items-center justify-center">
        <span className="text-muted-foreground text-xs">No ticker selected</span>
      </div>
    );
  }

  const changeColor = getChangeColor(stock.change);
  const isUp = stock.change > 0;
  const isDown = stock.change < 0;

  // Calculate 52-week range position
  const rangePos = stock.yearHigh !== stock.yearLow
    ? ((stock.price - stock.yearLow) / (stock.yearHigh - stock.yearLow)) * 100
    : 50;

  return (
    <div className="bb-panel flex flex-col h-full" data-testid="stock-detail">
      <div className="bb-panel-header">
        <div className="flex items-center gap-2">
          <span className="text-bb-orange font-bold text-xs tracking-wider">{stock.symbol}</span>
          <span className="text-2xs text-muted-foreground">DETAIL</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bb-scrollbar p-2 space-y-2 overflow-x-hidden">
        {/* Price section */}
        <div className="flex items-center gap-2">
          <div>
            <div className="text-xl font-bold tabular-nums">{formatPrice(stock.price)}</div>
            <div className={`flex items-center gap-1 text-xs ${changeColor}`}>
              {isUp ? <ArrowUpRight className="w-3 h-3" /> : isDown ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              <span className="tabular-nums">{formatChange(stock.change)}</span>
              <span className="tabular-nums">({formatPercent(stock.changesPercentage)})</span>
            </div>
          </div>
        </div>

        {/* Key metrics grid */}
        <div className="space-y-0 text-[10px]">
          <DetailRow label="Open" value={formatPrice(stock.open)} />
          <DetailRow label="PrevCl" value={formatPrice(stock.previousClose)} />
          <DetailRow label="Hi" value={formatPrice(stock.dayHigh)} />
          <DetailRow label="Lo" value={formatPrice(stock.dayLow)} />
          <DetailRow label="52wH" value={formatPrice(stock.yearHigh)} />
          <DetailRow label="52wL" value={formatPrice(stock.yearLow)} />
          <DetailRow label="Vol" value={formatVolume(stock.volume)} />
          <DetailRow label="AvgVol" value={formatVolume(stock.avgVolume)} />
          <DetailRow label="MktCap" value={formatNumber(stock.marketCap)} />
          <DetailRow label="P/E" value={stock.pe?.toFixed(1) ?? "—"} />
          <DetailRow label="EPS" value={stock.eps?.toFixed(2) ?? "—"} />
          <DetailRow label="Sector" value={stock.sector} />
        </div>

        {/* 52-week range bar */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-2xs text-muted-foreground">
            <span>52W Range</span>
          </div>
          <div className="relative h-1.5 bg-border rounded-full">
            <div
              className="absolute top-0 h-full bg-bb-orange/40 rounded-full"
              style={{ width: `${rangePos}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-bb-orange rounded-full border border-background"
              style={{ left: `calc(${rangePos}% - 4px)` }}
            />
          </div>
          <div className="flex justify-between text-2xs tabular-nums">
            <span className="text-muted-foreground">{formatPrice(stock.yearLow)}</span>
            <span className="text-muted-foreground">{formatPrice(stock.yearHigh)}</span>
          </div>
        </div>

        {/* Volume comparison */}
        <div className="space-y-0.5">
          <div className="text-2xs text-muted-foreground">Volume vs Avg</div>
          <div className="relative h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className={`absolute top-0 h-full rounded-full ${
                stock.volume > stock.avgVolume ? "bg-bb-green/50" : "bg-bb-blue/50"
              }`}
              style={{ width: `${Math.min((stock.volume / stock.avgVolume) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-2xs tabular-nums">
            <span className="text-foreground">{formatVolume(stock.volume)}</span>
            <span className="text-muted-foreground">Avg: {formatVolume(stock.avgVolume)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-px">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium tabular-nums text-foreground text-right truncate ml-2">{value}</span>
    </div>
  );
}
