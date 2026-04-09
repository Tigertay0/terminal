import { useState, useEffect } from "react";
import { Newspaper, Clock, ExternalLink } from "lucide-react";

interface NewsItem {
  title: string;
  source: string;
  time: string;
  category: string;
  isBreaking?: boolean;
}

interface NewsFeedProps {
  selectedSymbol: string;
}

// Generate realistic finance news
function generateNews(symbol: string): NewsItem[] {
  const baseNews: NewsItem[] = [
    { title: "Fed Minutes Signal Potential Rate Adjustments in Coming Months", source: "Reuters", time: "2m ago", category: "MACRO", isBreaking: true },
    { title: "Treasury Yields Climb as Inflation Data Exceeds Expectations", source: "Bloomberg", time: "8m ago", category: "BONDS" },
    { title: "Oil Prices Surge on OPEC+ Production Cut Extension", source: "CNBC", time: "14m ago", category: "CMDTY" },
    { title: "Tech Sector Leads Market Rally Amid Strong Earnings Season", source: "WSJ", time: "22m ago", category: "EQUITY" },
    { title: "China Manufacturing PMI Data Points to Economic Recovery", source: "FT", time: "31m ago", category: "GLOBAL" },
    { title: "Semiconductor Stocks Jump on AI Demand Forecasts", source: "Barrons", time: "38m ago", category: "TECH" },
    { title: "European Markets Close Higher on ECB Policy Signals", source: "Reuters", time: "45m ago", category: "GLOBAL" },
    { title: "Corporate Bond Issuance Hits Record Amid Rate Uncertainty", source: "Bloomberg", time: "52m ago", category: "FI" },
    { title: "Dollar Index Weakens After Mixed Employment Report", source: "FX Weekly", time: "1h ago", category: "FX" },
    { title: "Crypto Markets Stabilize After Weekend Volatility", source: "CoinDesk", time: "1h ago", category: "CRYPTO" },
    { title: "S&P 500 Approaches All-Time High on Broad Market Strength", source: "MarketWatch", time: "1h ago", category: "EQUITY" },
    { title: "Bank Earnings Expected to Show Resilient Net Interest Income", source: "WSJ", time: "2h ago", category: "FIN" },
    { title: "IPO Pipeline Grows as Market Conditions Improve", source: "Renaissance", time: "2h ago", category: "EQUITY" },
    { title: "Gold Hits New Record as Investors Seek Safe Haven Assets", source: "Kitco", time: "2h ago", category: "CMDTY" },
    { title: "Housing Data Shows Continued Strength in Existing Home Sales", source: "NAR", time: "3h ago", category: "ECON" },
  ];

  const symbolNews: Record<string, NewsItem[]> = {
    AAPL: [
      { title: "Apple Accelerates AI Integration Across Product Line", source: "Bloomberg", time: "5m ago", category: "AAPL" },
      { title: "iPhone Sales Beat Estimates in Greater China Region", source: "WSJ", time: "18m ago", category: "AAPL" },
    ],
    MSFT: [
      { title: "Microsoft Azure Revenue Growth Accelerates on AI Workloads", source: "CNBC", time: "7m ago", category: "MSFT" },
      { title: "Microsoft Copilot Enterprise Adoption Exceeds 200K Customers", source: "Reuters", time: "25m ago", category: "MSFT" },
    ],
    NVDA: [
      { title: "NVIDIA Blackwell Chips See Unprecedented Demand From Hyperscalers", source: "Bloomberg", time: "3m ago", category: "NVDA", isBreaking: true },
      { title: "NVIDIA Data Center Revenue Expected to Double Year-Over-Year", source: "Barrons", time: "19m ago", category: "NVDA" },
    ],
    TSLA: [
      { title: "Tesla FSD V13 Rollout Begins Across North America", source: "Electrek", time: "6m ago", category: "TSLA" },
      { title: "Tesla Energy Storage Deployments Surge in Q1", source: "Reuters", time: "28m ago", category: "TSLA" },
    ],
    GOOGL: [
      { title: "Google Cloud AI Revenue Hits $10B Annual Run Rate", source: "CNBC", time: "11m ago", category: "GOOGL" },
      { title: "Alphabet Faces New Antitrust Remedies in Search Case", source: "NYT", time: "42m ago", category: "GOOGL" },
    ],
  };

  const specificNews = symbolNews[symbol] || [];
  return [...specificNews, ...baseNews];
}

export function NewsFeed({ selectedSymbol }: NewsFeedProps) {
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    setNews(generateNews(selectedSymbol));
  }, [selectedSymbol]);

  const getCategoryColor = (cat: string) => {
    if (cat === "MACRO" || cat === "ECON") return "text-bb-yellow";
    if (cat === "EQUITY" || cat === "TECH") return "text-bb-green";
    if (cat === "FX" || cat === "CRYPTO") return "text-bb-cyan";
    if (cat === "CMDTY") return "text-bb-orange";
    if (cat === "BONDS" || cat === "FI" || cat === "FIN") return "text-bb-blue";
    if (cat === "GLOBAL") return "text-muted-foreground";
    return "text-bb-orange"; // ticker-specific
  };

  return (
    <div className="bb-panel flex flex-col h-full" data-testid="news-feed">
      <div className="bb-panel-header">
        <div className="flex items-center gap-1.5">
          <Newspaper className="w-3 h-3 text-bb-orange" />
          <span className="text-2xs font-bold text-bb-orange tracking-wider uppercase">News</span>
        </div>
        <span className="text-2xs text-muted-foreground">LIVE</span>
      </div>

      <div className="flex-1 overflow-y-auto bb-scrollbar">
        {news.map((item, i) => (
          <div
            key={i}
            className={`px-2 py-1.5 border-b border-border/50 hover:bg-white/[0.02] cursor-pointer transition-colors ${
              item.isBreaking ? "bg-bb-red/[0.04]" : ""
            }`}
            data-testid={`news-item-${i}`}
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
                  <span className={`text-[9px] font-bold ${getCategoryColor(item.category)}`}>{item.category}</span>
                  <span className="text-[9px] text-muted-foreground">{item.source}</span>
                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-2 h-2" />
                    {item.time}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
