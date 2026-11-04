import { useEffect, useMemo, useState } from "react";
import { fetchJSON, formatPrice, formatPercent, getChangeColor } from "@/lib/finance-api";

interface Quote {
  symbol: string;
  price: number;
  change: number;
  changesPercentage: number;
}

interface Bar {
  date: string;
  close: number;
}

const LEAD = "^GSPC";
const ROWS: { symbol: string; name: string }[] = [
  { symbol: "^IXIC", name: "Nasdaq" },
  { symbol: "^DJI", name: "Dow" },
  { symbol: "^RUT", name: "Russell 2000" },
  { symbol: "^VIX", name: "VIX" },
];

const W = 560;
const H = 220;
const PAD_Y = 12;

/** Builds the S&P 500 line and its fill from closing prices. */
function linePaths(bars: Bar[]) {
  const closes = bars.map(b => b.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const points = closes.map((c, i) => [
    (i / (closes.length - 1)) * W,
    PAD_Y + (1 - (c - min) / span) * (H - PAD_Y * 2),
  ] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${W},${H} L0,${H} Z`, last: points[points.length - 1], min, max };
}

/**
 * The sign-in screen's moment: today's real index board and three months of the
 * S&P 500, drawn from the same Yahoo Finance data the terminal uses.
 */
export function MarketPreview() {
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [bars, setBars] = useState<Bar[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const symbols = [LEAD, ...ROWS.map(r => r.symbol)].join(",");
    Promise.all([
      fetchJSON<Quote[]>(`/api/yf/quote?symbols=${encodeURIComponent(symbols)}`, { signal: controller.signal }),
      fetchJSON<Bar[]>(`/api/yf/chart?symbol=${encodeURIComponent(LEAD)}&range=3mo&interval=1d`, { signal: controller.signal }),
    ])
      .then(([q, b]) => {
        if (controller.signal.aborted) return;
        setQuotes(new Map(q.map(x => [x.symbol, x])));
        setBars(b.filter(x => typeof x.close === "number"));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("Market preview failed:", err);
        setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const paths = useMemo(() => (bars.length > 1 ? linePaths(bars) : null), [bars]);
  const lead = quotes.get(LEAD);
  const firstClose = bars[0]?.close;
  const threeMonth = lead && firstClose ? ((lead.price - firstClose) / firstClose) * 100 : null;

  if (failed) {
    return <p className="text-xs text-muted-foreground">Market data is unavailable right now</p>;
  }

  return (
    <figure className="w-full max-w-[600px] rounded-lg border border-border bg-card rise-in" aria-label="S&P 500 over the past three months">
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <figcaption className="text-xs text-muted-foreground">S&P 500 · past 3 months</figcaption>
          <div className="num text-3xl text-foreground mt-2 leading-none">{lead ? formatPrice(lead.price) : "—"}</div>
          {lead && (
            <div className={`num text-xs mt-2 ${getChangeColor(lead.change)}`}>
              {formatPercent(lead.changesPercentage)} today
              {threeMonth !== null && (
                <span className="text-muted-foreground"> · {formatPercent(threeMonth)} over 3 months</span>
              )}
            </div>
          )}
        </div>
        <span className="flex items-center gap-2 text-2xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-up" />
          Yahoo Finance
        </span>
      </div>

      <div className="relative px-5 pt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" preserveAspectRatio="none" role="presentation">
          <defs>
            <linearGradient id="preview-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="hsl(var(--border))" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {paths ? (
            <>
              <path d={paths.area} fill="url(#preview-fill)" />
              <path d={paths.line} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </>
          ) : (
            <rect x="0" y={H / 2} width={W} height="1" fill="hsl(var(--border))" />
          )}
        </svg>
        {paths && (
          <span
            className="absolute w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-primary pointer-events-none"
            style={{ left: `calc(20px + (100% - 40px) * ${paths.last[0] / W})`, top: `calc(16px + (100% - 16px) * ${paths.last[1] / H})` }}
          />
        )}
        {paths && (
          <div className="absolute right-5 top-4 bottom-0 flex flex-col justify-between pointer-events-none num text-2xs text-muted-foreground text-right">
            <span>{formatPrice(paths.max)}</span>
            <span>{formatPrice(paths.min)}</span>
          </div>
        )}
      </div>

      <dl className="mt-4 border-t border-border">
        {ROWS.map(row => {
          const q = quotes.get(row.symbol);
          return (
            <div key={row.symbol} className="grid grid-cols-[minmax(0,1fr)_auto_72px] items-center gap-4 h-9 px-5 border-b border-border/60 last:border-0 text-xs">
              <dt className="text-dim">{row.name}</dt>
              <dd className="num text-foreground text-right">{q ? formatPrice(q.price) : "—"}</dd>
              <dd className={`num text-right ${q ? getChangeColor(q.change) : "text-muted-foreground"}`}>{q ? formatPercent(q.changesPercentage) : "—"}</dd>
            </div>
          );
        })}
      </dl>
    </figure>
  );
}
