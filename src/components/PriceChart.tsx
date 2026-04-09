import { useEffect, useRef, useState } from "react";
import type { OHLCVBar, TickerData } from "@/hooks/use-finance-data";
import { formatPrice, formatPercent, formatChange, getChangeColor, formatNumber, formatVolume } from "@/lib/finance-api";

interface PriceChartProps {
  symbol: string;
  stock: TickerData | undefined;
  historicalData: OHLCVBar[];
}

type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y";

export function PriceChart({ symbol, stock, historicalData }: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("3M");
  const [hoverInfo, setHoverInfo] = useState<{ x: number; price: number; date: string; vol: number } | null>(null);

  // Filter data by time range
  const filteredData = (() => {
    if (!historicalData.length) return [];
    const now = new Date();
    let daysBack = 90;
    switch (timeRange) {
      case "1W": daysBack = 7; break;
      case "1M": daysBack = 30; break;
      case "3M": daysBack = 90; break;
      case "6M": daysBack = 180; break;
      case "1Y": daysBack = 365; break;
    }
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - daysBack);
    return historicalData.filter(d => new Date(d.date) >= cutoff);
  })();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !filteredData.length) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const chartHeight = rect.height - 40; // Reserve space for volume
    const volHeight = 35;

    canvas.width = width * dpr;
    canvas.height = (chartHeight + volHeight) * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${chartHeight + volHeight}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, chartHeight + volHeight);

    const prices = filteredData.map(d => d.close);
    const volumes = filteredData.map(d => d.volume);
    const minPrice = Math.min(...prices) * 0.998;
    const maxPrice = Math.max(...prices) * 1.002;
    const maxVol = Math.max(...volumes);
    const priceRange = maxPrice - minPrice;

    const padding = { left: 0, right: 0, top: 4, bottom: 4 };
    const chartW = width - padding.left - padding.right;

    // Draw grid lines
    ctx.strokeStyle = "hsla(220, 10%, 20%, 0.4)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const y = padding.top + (chartHeight - padding.top - padding.bottom) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw price line
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const isUp = lastPrice >= firstPrice;
    const lineColor = isUp ? "hsl(142, 76%, 36%)" : "hsl(0, 72%, 51%)";
    const fillColor = isUp ? "hsla(142, 76%, 36%, 0.08)" : "hsla(0, 72%, 51%, 0.08)";

    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;

    filteredData.forEach((d, i) => {
      const x = padding.left + (i / (filteredData.length - 1)) * chartW;
      const y = padding.top + (1 - (d.close - minPrice) / priceRange) * (chartHeight - padding.top - padding.bottom);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill area under the line
    ctx.lineTo(padding.left + chartW, chartHeight);
    ctx.lineTo(padding.left, chartHeight);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Draw volume bars
    const volTop = chartHeight + 5;
    filteredData.forEach((d, i) => {
      const x = padding.left + (i / (filteredData.length - 1)) * chartW;
      const barH = (d.volume / maxVol) * (volHeight - 5);
      const barW = Math.max(1, chartW / filteredData.length - 0.5);
      const barIsUp = d.close >= d.open;
      ctx.fillStyle = barIsUp ? "hsla(142, 76%, 36%, 0.3)" : "hsla(0, 72%, 51%, 0.3)";
      ctx.fillRect(x - barW / 2, volTop + volHeight - 5 - barH, barW, barH);
    });

    // Hover handling
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const idx = Math.round((mx - padding.left) / chartW * (filteredData.length - 1));
      if (idx >= 0 && idx < filteredData.length) {
        setHoverInfo({
          x: mx,
          price: filteredData[idx].close,
          date: filteredData[idx].date,
          vol: filteredData[idx].volume,
        });
      }
    };

    const handleMouseLeave = () => setHoverInfo(null);

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [filteredData, timeRange]);

  if (!stock) {
    return (
      <div className="bb-panel flex flex-col h-full items-center justify-center">
        <span className="text-muted-foreground text-xs">Select a ticker to view chart</span>
      </div>
    );
  }

  const changeColor = getChangeColor(stock.change);

  return (
    <div className="bb-panel flex flex-col h-full" data-testid="price-chart">
      {/* Header */}
      <div className="bb-panel-header">
        <div className="flex items-center gap-3">
          <span className="text-bb-orange font-bold text-xs">{symbol}</span>
          <span className="text-2xs text-muted-foreground truncate max-w-[160px]">{stock.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {(["1W", "1M", "3M", "6M", "1Y"] as TimeRange[]).map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`text-2xs px-1.5 py-0.5 rounded-sm font-medium transition-colors ${
                timeRange === r
                  ? "bg-bb-orange/20 text-bb-orange"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-range-${r}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Price info bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-b border-border bg-[hsl(220,14%,7%)]">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold tabular-nums">{formatPrice(stock.price)}</span>
          <span className={`text-xs font-medium tabular-nums ${changeColor}`}>
            {formatChange(stock.change)} ({formatPercent(stock.changesPercentage)})
          </span>
        </div>
        <div className="flex items-center gap-3 text-2xs text-muted-foreground ml-auto">
          <span>O: <span className="text-foreground tabular-nums">{formatPrice(stock.open)}</span></span>
          <span>H: <span className="text-foreground tabular-nums">{formatPrice(stock.dayHigh)}</span></span>
          <span>L: <span className="text-foreground tabular-nums">{formatPrice(stock.dayLow)}</span></span>
          <span>Vol: <span className="text-foreground tabular-nums">{formatVolume(stock.volume)}</span></span>
        </div>
      </div>

      {/* Chart area */}
      <div ref={containerRef} className="flex-1 relative min-h-0 px-1 pt-1">
        <canvas ref={canvasRef} className="w-full h-full" />
        {hoverInfo && (
          <div
            className="absolute top-1 pointer-events-none bg-[hsl(220,14%,9%)]/90 border border-border rounded-sm px-2 py-1"
            style={{ left: Math.min(hoverInfo.x + 8, (containerRef.current?.clientWidth || 300) - 120) }}
          >
            <div className="text-2xs text-muted-foreground">{hoverInfo.date}</div>
            <div className="text-xs font-bold tabular-nums">${formatPrice(hoverInfo.price)}</div>
            <div className="text-2xs text-muted-foreground tabular-nums">Vol: {formatVolume(hoverInfo.vol)}</div>
          </div>
        )}
      </div>

      {/* Key stats bar */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-border text-2xs">
        <StatItem label="Mkt Cap" value={formatNumber(stock.marketCap)} />
        <StatItem label="P/E" value={stock.pe?.toFixed(1) ?? "—"} />
        <StatItem label="EPS" value={stock.eps?.toFixed(2) ?? "—"} />
        <StatItem label="52W H" value={formatPrice(stock.yearHigh)} />
        <StatItem label="52W L" value={formatPrice(stock.yearLow)} />
        <StatItem label="Avg Vol" value={formatVolume(stock.avgVolume)} />
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground font-medium tabular-nums">{value}</span>
    </div>
  );
}
