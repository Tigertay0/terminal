import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { fetchJSON } from "@/lib/finance-api";

interface NewsItem {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  tickers: string[];
}

interface NewsFeedProps {
  selectedSymbol: string;
}

const REFRESH_MS = 120_000;

type FeedState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: NewsItem[] };

function timeAgo(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Real Yahoo Finance stories about the selected symbol, refreshed every two minutes. */
export function NewsFeed({ selectedSymbol }: NewsFeedProps) {
  const [state, setState] = useState<FeedState>({ status: "loading" });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = async (showLoading: boolean) => {
      if (showLoading) setState({ status: "loading" });
      try {
        const items = await fetchJSON<NewsItem[]>(`/api/yf/news?symbol=${encodeURIComponent(selectedSymbol)}`);
        if (!cancelled) {
          setState({ status: "ready", items });
          setNow(Date.now());
        }
      } catch (err) {
        console.error("News fetch failed:", err);
        // Keep stories already on screen when a background refresh fails
        if (!cancelled) setState(prev => (prev.status === "ready" && !showLoading ? prev : { status: "error" }));
      }
    };
    load(true);
    const interval = setInterval(() => load(false), REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedSymbol]);

  return (
    <div className="rf-panel h-full" data-testid="news-feed">
      <div className="rf-panel-header">
        <span className="rf-panel-title">News</span>
        <span className="text-2xs text-muted-foreground">
          <span className="num">{selectedSymbol}</span> · Yahoo Finance
        </span>
      </div>

      <div className="flex-1 overflow-y-auto rf-scrollbar">
        {state.status === "loading" && (
          <div className="px-3 py-3 space-y-4" aria-label="Loading news">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-raised rounded w-full" />
                <div className="h-3 bg-raised rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {state.status === "error" && (
          <p className="px-3 py-4 text-xs text-muted-foreground">News is unavailable right now. It retries every two minutes.</p>
        )}

        {state.status === "ready" && state.items.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground">No recent stories for <span className="num">{selectedSymbol}</span></p>
        )}

        {state.status === "ready" && state.items.map((item, i) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block px-3 py-2 border-b border-border/60 hover:bg-raised/60 transition-colors"
            data-testid={`news-item-${i}`}
          >
            <div className="text-xs text-foreground leading-snug line-clamp-2">
              {item.title}
              <ArrowUpRight className="inline w-3 h-3 ml-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
            </div>
            <div className="flex items-center gap-2 mt-1 text-2xs text-muted-foreground">
              <span className="truncate">{item.publisher}</span>
              <span>·</span>
              <span className="shrink-0">{timeAgo(item.publishedAt, now)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
