import { useEffect, useRef } from "react";
import { formatPrice, formatChange, formatPercent, getChangeColor } from "@/lib/finance-api";
import type { IndexData } from "@/hooks/use-finance-data";

interface IndexTickerProps {
  indices: IndexData[];
}

export function IndexTicker({ indices }: IndexTickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pos = 0;
    const speed = 0.5;
    const animate = () => {
      pos += speed;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
      requestAnimationFrame(animate);
    };
    const raf = requestAnimationFrame(animate);
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
