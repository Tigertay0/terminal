import { formatPrice, formatChange, formatPercent, getChangeColor, formatNumber, formatVolume } from "@/lib/finance-api";
import type { TickerData } from "@/hooks/use-finance-data";

interface StockDetailProps {
  stock: TickerData | undefined;
}

export function StockDetail({ stock }: StockDetailProps) {
  if (!stock) {
    return (
      <div className="rf-panel h-full items-center justify-center">
        <span className="text-muted-foreground text-xs">Select a symbol to see its numbers</span>
      </div>
    );
  }

  const changeColor = getChangeColor(stock.change);

  // Where today's price sits in the 52-week range
  const rangePos = stock.yearHigh !== stock.yearLow
    ? Math.min(100, Math.max(0, ((stock.price - stock.yearLow) / (stock.yearHigh - stock.yearLow)) * 100))
    : 50;
  const volumeRatio = stock.avgVolume > 0 ? stock.volume / stock.avgVolume : 0;

  return (
    <div className="rf-panel h-full" data-testid="stock-detail">
      <div className="rf-panel-header">
        <span className="rf-panel-title">Detail</span>
        <span className="num text-2xs text-muted-foreground">{stock.symbol}</span>
      </div>

      <div className="flex-1 overflow-y-auto rf-scrollbar px-3 py-3 space-y-4 overflow-x-hidden">
        <div>
          <div className="num text-2xl text-foreground leading-none">{formatPrice(stock.price)}</div>
          <div className={`num text-xs mt-2 ${changeColor}`}>
            {formatChange(stock.change)} ({formatPercent(stock.changesPercentage)}) today
          </div>
        </div>

        <dl className="text-xs">
          <DetailRow label="Open" value={formatPrice(stock.open)} />
          <DetailRow label="Previous close" value={formatPrice(stock.previousClose)} />
          <DetailRow label="Day high" value={formatPrice(stock.dayHigh)} />
          <DetailRow label="Day low" value={formatPrice(stock.dayLow)} />
          <DetailRow label="Market cap" value={formatNumber(stock.marketCap)} />
          <DetailRow label="P/E" value={stock.pe?.toFixed(1) ?? "—"} />
          <DetailRow label="EPS" value={stock.eps?.toFixed(2) ?? "—"} />
          <DetailRow label="Sector" value={stock.sector || "—"} plain />
        </dl>

        <div className="space-y-2">
          <div className="flex justify-between text-2xs text-muted-foreground">
            <span>52-week range</span>
            <span className="num">{Math.round(rangePos)}% of range</span>
          </div>
          <div className="relative h-1 bg-raised rounded-full">
            <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-ink rounded-full" style={{ left: `calc(${rangePos}% - 1px)` }} />
          </div>
          <div className="flex justify-between num text-2xs text-muted-foreground">
            <span>{formatPrice(stock.yearLow)}</span>
            <span>{formatPrice(stock.yearHigh)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-2xs text-muted-foreground">
            <span>Volume vs 3-month average</span>
            <span className="num">{volumeRatio > 0 ? `${volumeRatio.toFixed(2)}×` : "—"}</span>
          </div>
          <div className="relative h-1 bg-raised rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-dim/60 rounded-full" style={{ width: `${Math.min(volumeRatio * 100, 100)}%` }} />
          </div>
          <div className="flex justify-between num text-2xs">
            <span className="text-foreground">{formatVolume(stock.volume)}</span>
            <span className="text-muted-foreground">avg {formatVolume(stock.avgVolume)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, plain }: { label: string; value: string; plain?: boolean }) {
  return (
    <div className="flex justify-between items-center h-7 border-b border-border/60 last:border-0">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className={`text-foreground text-right truncate ml-2 ${plain ? "" : "num"}`}>{value}</dd>
    </div>
  );
}
