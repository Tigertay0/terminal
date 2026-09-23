import { useEffect, useRef } from "react";
import { formatPrice, formatChange, formatPercent, getChangeColor } from "@/lib/finance-api";
import type { IndexData } from "@/hooks/use-finance-data";

interface IndexTickerProps {
  indices: IndexData[];
}

export function IndexTicker({ indices }: IndexTickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Kept across effect restarts so a data refresh doesn't jump the ticker back to the start.
  const posRef = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const speed = 0.5;
    let raf = 0;
    const animate = () => {
      posRef.current += speed;
      if (posRef.current >= el.scrollWidth / 2) posRef.current = 0;
      el.scrollLeft = posRef.current;
      // Track the latest frame id so cleanup cancels the running loop, not just its first frame.
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [indices]);

  // Double the items for seamless looping
  const items = [...indices, ...indices];

  return (
    <div
      className="h-6 bg-sidebar border-b border-border overflow-hidden shrink-0 select-none"
      data-testid="index-ticker"
    >
      <div ref={scrollRef} className="flex items-center h-full gap-6 px-2 overflow-hidden whitespace-nowrap">
        {items.map((idx, i) => (
          <div key={`${idx.symbol}-${i}`} className="flex items-center gap-1.5 shrink-0">
            <span className="text-2xs font-medium text-muted-foreground">{idx.name}</span>
            <span className="text-2xs font-bold text-foreground tabular-nums">{formatPrice(idx.price)}</span>
            <span className={`text-2xs tabular-nums ${getChangeColor(idx.change)}`}>
              {formatChange(idx.change)}
            </span>
            <span className={`text-2xs tabular-nums ${getChangeColor(idx.changesPercentage)}`}>
              ({formatPercent(idx.changesPercentage)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
