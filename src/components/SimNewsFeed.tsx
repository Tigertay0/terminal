import { Newspaper, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { SimNewsItem } from "@/hooks/use-simulation";

interface SimNewsFeedProps {
  news: SimNewsItem[];
  selectedSymbol: string;
}

export function SimNewsFeed({ news, selectedSymbol }: SimNewsFeedProps) {
  const getCategoryColor = (cat: string) => {
    if (cat === "MACRO" || cat === "ECON") return "text-bb-yellow";
    if (cat === "EQUITY" || cat === "TECH") return "text-bb-green";
    if (cat === "FX" || cat === "CRYPTO") return "text-bb-cyan";
    if (cat === "CMDTY") return "text-bb-orange";
    if (cat === "BONDS" || cat === "FI" || cat === "FIN") return "text-bb-blue";
    if (cat === "GLOBAL") return "text-muted-foreground";
    return "text-bb-orange";
  };

  const getSentimentIcon = (sentiment: string) => {
    if (sentiment === "bullish") return <TrendingUp className="w-2.5 h-2.5 text-bb-green" />;
    if (sentiment === "bearish") return <TrendingDown className="w-2.5 h-2.5 text-bb-red" />;
    return <Minus className="w-2.5 h-2.5 text-muted-foreground" />;
  };

  const getSentimentBg = (sentiment: string) => {
    if (sentiment === "bullish") return "bg-bb-green/[0.04] border-l-2 border-l-bb-green/30";
    if (sentiment === "bearish") return "bg-bb-red/[0.04] border-l-2 border-l-bb-red/30";
    return "";
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  // Sort: show symbol-specific news first if matching selected
  const sortedNews = [...news].sort((a, b) => {
    if (a.symbol === selectedSymbol && b.symbol !== selectedSymbol) return -1;
    if (b.symbol === selectedSymbol && a.symbol !== selectedSymbol) return 1;
    return 0;
  });

  return (
    <div className="bb-panel flex flex-col h-full" data-testid="sim-news-feed">
      <div className="bb-panel-header">
        <div className="flex items-center gap-1.5">
          <Newspaper className="w-3 h-3 text-bb-orange" />
          <span className="text-2xs font-bold text-bb-orange tracking-wider uppercase">SIM NEWS</span>
        </div>
        <span className="text-2xs text-muted-foreground">{news.length} ITEMS</span>
      </div>

      <div className="flex-1 overflow-y-auto bb-scrollbar">
        {news.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Newspaper className="w-6 h-6 text-muted-foreground/30 mb-2" />
            <div className="text-[11px] text-muted-foreground">No news yet</div>
            <div className="text-[10px] text-muted-foreground/60 mt-1">Start the simulation to see news</div>
          </div>
        ) : (
          sortedNews.map(item => (
            <div
              key={item.id}
              className={`px-2 py-1.5 border-b border-border/50 hover:bg-white/[0.02] cursor-pointer transition-colors ${
                item.isBreaking ? "bg-bb-red/[0.06]" : getSentimentBg(item.sentiment)
              }`}
              data-testid={`sim-news-${item.id}`}
            >
              <div className="flex items-start gap-1.5">
                {item.isBreaking && (
                  <span className="text-[9px] font-bold bg-bb-red/20 text-bb-red px-1 py-0 rounded-sm shrink-0 mt-px">
                    ALERT
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-foreground leading-tight line-clamp-2">{item.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getSentimentIcon(item.sentiment)}
                    <span className={`text-[9px] font-bold ${
                      item.sentiment === "bullish" ? "text-bb-green" :
                      item.sentiment === "bearish" ? "text-bb-red" : "text-muted-foreground"
                    }`}>
                      {item.sentiment.toUpperCase()}
                    </span>
                    <span className={`text-[9px] font-bold ${getCategoryColor(item.category)}`}>{item.category}</span>
                    <span className="text-[9px] text-muted-foreground">{item.source}</span>
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="w-2 h-2" />
                      {formatTime(item.time)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
