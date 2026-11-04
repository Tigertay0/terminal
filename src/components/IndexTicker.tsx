import { useEffect, useRef, useState } from "react";
import { formatPrice, formatPercent, getChangeColor } from "@/lib/finance-api";
import type { IndexData } from "@/hooks/use-finance-data";

interface IndexTickerProps {
  indices: IndexData[];
}

// Yahoo's long index names, shortened the way a desk would say them
const SHORT_NAMES: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^DJI": "Dow",
  "^IXIC": "Nasdaq",
  "^RUT": "Russell 2000",
  "^VIX": "VIX",
  "^FTSE": "FTSE 100",
  "^N225": "Nikkei 225",
  "^HSI": "Hang Seng",
  "^GDAXI": "DAX",
};

const PIXELS_PER_FRAME = 0.4;

/** The tape: live index quotes that scroll slowly, pause on hover and stay still for reduced motion. */
export function IndexTicker({ indices }: IndexTickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Kept across effect restarts so a data refresh doesn't jump the ticker back to the start.
  const posRef = useRef(0);
  const pausedRef = useRef(false);
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (reducedMotion) return;
    let raf = 0;
    const animate = () => {
      if (!pausedRef.current) {
        posRef.current += PIXELS_PER_FRAME;
        if (posRef.current >= el.scrollWidth / 2) posRef.current = 0;
        el.scrollLeft = posRef.current;
      }
      // Track the latest frame id so cleanup cancels the running loop, not just its first frame.
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [indices, reducedMotion]);

  // Double the items for seamless looping
  const items = reducedMotion ? indices : [...indices, ...indices];

  return (
    <div
      className="h-8 bg-sidebar border-b border-border overflow-hidden shrink-0 select-none"
      data-testid="index-ticker"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div ref={scrollRef} className={`flex items-center h-full gap-8 px-3 whitespace-nowrap ${reducedMotion ? "overflow-x-auto" : "overflow-hidden"}`}>
        {items.map((idx, i) => (
          <div key={`${idx.symbol}-${i}`} className="flex items-baseline gap-2 shrink-0 text-xs" aria-hidden={i >= indices.length}>
            <span className="text-muted-foreground">{SHORT_NAMES[idx.symbol] ?? idx.name}</span>
            <span className="num text-foreground">{formatPrice(idx.price)}</span>
            <span className={`num ${getChangeColor(idx.changesPercentage)}`}>{formatPercent(idx.changesPercentage)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
