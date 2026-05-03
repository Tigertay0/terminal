import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Newspaper, X, ChevronDown, ChevronUp, Filter,
  TrendingUp, TrendingDown, AlertTriangle, RefreshCw,
  Search, Clock, Zap
} from "lucide-react";
import type { AINewsItem } from "@/lib/ai-news";
import { fetchAINewsDetails } from "@/lib/ai-news";

// ─── Types ───────────────────────────────────────────────────────
interface SimNewsPanelProps {
  aiNews: AINewsItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onUpdateNews?: (updater: (items: AINewsItem[]) => AINewsItem[]) => void;
  /** All sectors present in the simulation */
  sectors: string[];
  /** All company symbols in the simulation */
  companies: { symbol: string; name: string }[];
  /** Stocks for detail fetch */
  stocks?: { symbol: string; name: string; price: number; sector: string; marketCap: number }[];
  variation?: string;
}

type ImportanceFilter = "all" | "high" | "low";

// ─── Component ───────────────────────────────────────────────────
export function SimNewsPanel({
  aiNews,
  loading,
  error,
  onRetry,
  onUpdateNews,
  sectors,
  companies,
  stocks,
  variation,
}: SimNewsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Filter state
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [importanceFilter, setImportanceFilter] = useState<ImportanceFilter>("all");
  const [growthRange, setGrowthRange] = useState<[number, number]>([-30, 30]);
  const [companySearch, setCompanySearch] = useState("");

  // ─── Filtered items ────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    return aiNews.filter(item => {
      // Company filter
      if (selectedCompanies.size > 0 && !selectedCompanies.has(item.companyId)) return false;
      // Sector filter
      if (selectedSector !== "all" && item.sector !== selectedSector) return false;
      // Importance filter
      if (importanceFilter !== "all" && item.importance !== importanceFilter) return false;
      // Growth range
      if (item.expectedGrowth < growthRange[0] || item.expectedGrowth > growthRange[1]) return false;
      return true;
    });
  }, [aiNews, selectedCompanies, selectedSector, importanceFilter, growthRange]);

  const highItems = useMemo(() => aiNews.filter(i => i.importance === "high"), [aiNews]);
  const displayedMinimized = highItems.slice(0, 5);
  const moreCount = aiNews.length - displayedMinimized.length;

  const toggleCompany = useCallback((sym: string) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedCompanies(new Set());
    setSelectedSector("all");
    setImportanceFilter("all");
    setGrowthRange([-30, 30]);
    setCompanySearch("");
  }, []);

  const uniqueSectors = useMemo(() => {
    const fromNews = new Set(aiNews.map(i => i.sector));
    sectors.forEach(s => fromNews.add(s));
    return Array.from(fromNews).filter(Boolean).sort();
  }, [aiNews, sectors]);

  const filteredCompanies = useMemo(() => {
    if (!companySearch) return companies;
    const q = companySearch.toLowerCase();
    return companies.filter(c =>
      c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [companies, companySearch]);

  // ─── Fetch details on expand ──────────────────────────────────
  const lastDetailFetchCount = useRef(0);
  useEffect(() => {
    if (!expanded || !stocks || !variation || !onUpdateNews) return;
    // Only AI items (not template) need detail fetching
    const aiItems = aiNews.filter(i => i.id.startsWith("ai-") && !i.summary);
    if (aiItems.length === 0) return;
    // Don't re-fetch if we already fetched for this batch
    if (lastDetailFetchCount.current === aiNews.length) return;
    lastDetailFetchCount.current = aiNews.length;

    setDetailsLoading(true);

    fetchAINewsDetails(aiItems, stocks, variation).then(detailMap => {
      if (detailMap.size > 0) {
        onUpdateNews(prev => prev.map(item => {
          const detail = detailMap.get(item.id);
          return detail ? { ...item, summary: detail } : item;
        }));
      }
    }).finally(() => setDetailsLoading(false));
  }, [expanded, aiNews, stocks, variation, onUpdateNews]);

  // ─── EXPANDED VIEW ─────────────────────────────────────────────
  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md" data-testid="sim-news-expanded">
        {/* Header */}
        <div className="bb-panel-header shrink-0 border-b border-border">
          <div className="flex items-center gap-1.5">
            <Newspaper className="w-3 h-3 text-bb-orange" />
            <span className="text-2xs font-bold text-bb-orange tracking-wider uppercase">
              MARKET NEWS
            </span>
            <span className="text-2xs text-muted-foreground ml-1">{filteredItems.length} / {aiNews.length}</span>
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 -mr-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter toolbar */}
        <div className="border-b border-border bg-[hsl(220,14%,7%)] px-2 py-1.5 space-y-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-[9px] font-bold text-muted-foreground tracking-wider">FILTERS</span>
            {(selectedCompanies.size > 0 || selectedSector !== "all" || importanceFilter !== "all" || growthRange[0] !== -30 || growthRange[1] !== 30) && (
              <button
                onClick={clearFilters}
                className="text-[9px] text-bb-cyan hover:text-bb-cyan/80 ml-auto"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Row 1: Sector + Importance */}
          <div className="flex items-center gap-2">
            <select
              value={selectedSector}
              onChange={e => setSelectedSector(e.target.value)}
              className="bg-[hsl(220,14%,9%)] border border-border/50 rounded-sm px-1.5 py-0.5 text-[10px] text-foreground outline-none w-28"
            >
              <option value="all">All Sectors</option>
              {uniqueSectors.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <div className="flex gap-0.5">
              {(["all", "high", "low"] as ImportanceFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setImportanceFilter(f)}
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm transition-colors ${
                    importanceFilter === f
                      ? f === "high"
                        ? "bg-amber-500/20 text-amber-400"
                        : f === "low"
                          ? "bg-zinc-500/20 text-zinc-400"
                          : "bg-bb-orange/20 text-bb-orange"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "ALL" : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Company search */}
          <div className="relative">
            <Search className="w-2.5 h-2.5 absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={companySearch}
              onChange={e => setCompanySearch(e.target.value)}
              placeholder="Filter by company..."
              className="w-full bg-[hsl(220,14%,9%)] border border-border/50 rounded-sm pl-5 pr-2 py-0.5 text-[10px] text-foreground outline-none placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Company chips */}
          {(companySearch || selectedCompanies.size > 0) && (
            <div className="flex flex-wrap gap-0.5 max-h-14 overflow-y-auto bb-scrollbar">
              {filteredCompanies.map(c => (
                <button
                  key={c.symbol}
                  onClick={() => toggleCompany(c.symbol)}
                  className={`text-[9px] px-1.5 py-0.5 rounded-sm border transition-colors ${
                    selectedCompanies.has(c.symbol)
                      ? "border-bb-orange/50 bg-bb-orange/10 text-bb-orange"
                      : "border-border/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.symbol}
                </button>
              ))}
            </div>
          )}

          {/* Growth range slider */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground whitespace-nowrap">Growth:</span>
            <span className="text-[9px] text-bb-red font-mono w-8 text-right">{growthRange[0]}%</span>
            <input
              type="range"
              min={-30}
              max={30}
              value={growthRange[0]}
              onChange={e => setGrowthRange([+e.target.value, growthRange[1]])}
              className="flex-1 h-1 accent-bb-orange"
            />
            <input
              type="range"
              min={-30}
              max={30}
              value={growthRange[1]}
              onChange={e => setGrowthRange([growthRange[0], +e.target.value])}
              className="flex-1 h-1 accent-bb-orange"
            />
            <span className="text-[9px] text-bb-green font-mono w-8">{growthRange[1]}%</span>
          </div>
        </div>

        {/* News list */}
        <div className="flex-1 overflow-y-auto bb-scrollbar">
          {loading && (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse space-y-1.5 p-2 border-b border-border/30">
                  <div className="h-3 bg-white/[0.06] rounded w-3/4" />
                  <div className="h-2.5 bg-white/[0.04] rounded w-full" />
                  <div className="h-2.5 bg-white/[0.04] rounded w-2/3" />
                  <div className="flex gap-2">
                    <div className="h-2 bg-white/[0.05] rounded w-12" />
                    <div className="h-2 bg-white/[0.05] rounded w-8" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <AlertTriangle className="w-6 h-6 text-bb-red/60 mb-2" />
              <div className="text-[11px] text-bb-red font-medium mb-1">Failed to load news</div>
              <div className="text-[10px] text-muted-foreground mb-3">{error}</div>
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-1 bg-bb-orange/10 text-bb-orange text-[10px] font-bold rounded-sm hover:bg-bb-orange/20 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Newspaper className="w-6 h-6 text-muted-foreground/30 mb-2" />
              <div className="text-[11px] text-muted-foreground">
                {aiNews.length > 0 ? "No items match your filters" : "No news yet — start the simulation"}
              </div>
            </div>
          )}

          {detailsLoading && (
            <div className="px-4 py-2 bg-bb-cyan/5 border-b border-bb-cyan/20 flex items-center gap-2">
              <RefreshCw className="w-3 h-3 text-bb-cyan animate-spin" />
              <span className="text-[10px] text-bb-cyan">Loading in-depth articles...</span>
            </div>
          )}

          {!loading &&
            filteredItems.map(item => (
              <NewsCard key={item.id} item={item} detailsLoading={detailsLoading} />
            ))}
        </div>
      </div>
    );
  }

  // ─── MINIMIZED VIEW ────────────────────────────────────────────
  return (
    <div
      className="bb-panel flex flex-col h-full cursor-pointer group"
      onClick={() => setExpanded(true)}
      data-testid="sim-news-minimized"
    >
      <div className="bb-panel-header">
        <div className="flex items-center gap-1.5">
          <Newspaper className="w-3 h-3 text-bb-orange" />
          <span className="text-2xs font-bold text-bb-orange tracking-wider uppercase">NEWS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-muted-foreground">{aiNews.length} ITEMS</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bb-scrollbar">
        {loading && (
          <div className="space-y-2 p-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-1 p-1">
                <div className="h-2.5 bg-white/[0.06] rounded w-4/5" />
                <div className="flex gap-2">
                  <div className="h-2 bg-white/[0.04] rounded w-10" />
                  <div className="h-2 bg-white/[0.04] rounded w-8" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-4 px-3 text-center">
            <AlertTriangle className="w-4 h-4 text-bb-red/60 mb-1" />
            <div className="text-[10px] text-bb-red">News unavailable</div>
            <button
              onClick={e => { e.stopPropagation(); onRetry(); }}
              className="text-[9px] text-bb-cyan mt-1 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && aiNews.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center px-3">
            <Newspaper className="w-5 h-5 text-muted-foreground/30 mb-1" />
            <div className="text-[10px] text-muted-foreground">Awaiting market news...</div>
          </div>
        )}

        {!loading && !error &&
          displayedMinimized.map(item => (
            <MiniNewsCard key={item.id} item={item} />
          ))}

        {!loading && !error && moreCount > 0 && (
          <div className="px-2 py-1.5 text-center border-t border-border/30">
            <span className="text-[9px] text-bb-cyan font-medium">
              +{moreCount} more stories — click to expand
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── News Card (expanded) ────────────────────────────────────────
function NewsCard({ item, detailsLoading }: { item: AINewsItem; detailsLoading?: boolean }) {
  const growthColor = item.expectedGrowth >= 0 ? "text-bb-green" : "text-bb-red";
  const growthBg = item.expectedGrowth >= 0 ? "bg-bb-green/10" : "bg-bb-red/10";
  const importanceBg = item.importance === "high" ? "bg-amber-500/15 text-amber-400" : "bg-zinc-500/10 text-zinc-500";
  const sentiment = item.sentiment || "neutral";
  const isAlert = sentiment === "alert";

  // Sentiment badge styling (non-alert)
  const sentimentStyles: Record<string, string> = {
    bullish: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    bearish: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    neutral: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };
  const sentimentIcons: Record<string, string> = {
    bullish: "▲",
    bearish: "▼",
    neutral: "●",
  };

  // Alert card gets a dramatically different treatment
  if (isAlert) {
    return (
      <div className="relative border-b border-border/30">
        {/* Pulsing left stripe */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 animate-pulse" />

        {/* Alert banner */}
        <div className="ml-1.5 bg-red-500/10 border-b border-red-500/20 px-5 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse shrink-0" />
          <span className="text-[11px] font-black text-red-400 uppercase tracking-[0.15em]">
            ⚡ BREAKING ALERT
          </span>
          <span className={`text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-sm ${growthColor} ${growthBg} ml-auto flex items-center gap-1`}>
            {item.expectedGrowth >= 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {item.expectedGrowth >= 0 ? "+" : ""}{item.expectedGrowth.toFixed(1)}%
          </span>
        </div>

        {/* Content */}
        <div className="ml-1.5 px-5 py-3">
          <div className="text-base font-bold text-red-300 leading-snug mb-2">
            {item.headline}
          </div>

          {item.summary ? (
            <div className="text-xs text-muted-foreground leading-relaxed mb-3 max-w-4xl">
              {item.summary}
            </div>
          ) : detailsLoading ? (
            <div className="animate-pulse space-y-1.5 mb-3 max-w-4xl">
              <div className="h-3 bg-white/[0.06] rounded w-full" />
              <div className="h-3 bg-white/[0.04] rounded w-3/4" />
            </div>
          ) : null}

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-bb-orange bg-bb-orange/10 px-1.5 py-0.5 rounded-sm">
              {item.companyId}
            </span>
            <span className="text-xs text-muted-foreground bg-white/[0.04] px-1.5 py-0.5 rounded-sm">
              {item.sector}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${importanceBg}`}>
              {item.importance}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Non-alert card (bullish/bearish/neutral)
  return (
    <div className="px-6 py-4 border-b border-border/30 hover:bg-white/[0.015] transition-colors">
      {/* Headline row */}
      <div className="flex items-start gap-3 mb-2">
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${sentimentStyles[sentiment] || sentimentStyles.neutral}`}>
          {sentimentIcons[sentiment] || "●"} {sentiment}
        </span>
        <div className="text-base font-bold text-foreground leading-snug">
          {item.headline}
        </div>
      </div>

      {/* Summary / Article Body */}
      {item.summary ? (
        <div className="text-xs text-muted-foreground leading-relaxed mb-3 max-w-4xl ml-[72px]">
          {item.summary}
        </div>
      ) : detailsLoading ? (
        <div className="animate-pulse space-y-1.5 mb-3 max-w-4xl ml-[72px]">
          <div className="h-3 bg-white/[0.06] rounded w-full" />
          <div className="h-3 bg-white/[0.04] rounded w-3/4" />
        </div>
      ) : null}

      {/* Tags row */}
      <div className="flex items-center gap-2 flex-wrap ml-[72px]">
        <span className="text-xs font-bold text-bb-orange bg-bb-orange/10 px-1.5 py-0.5 rounded-sm">
          {item.companyId}
        </span>
        <span className="text-xs text-muted-foreground bg-white/[0.04] px-1.5 py-0.5 rounded-sm">
          {item.sector}
        </span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${importanceBg}`}>
          {item.importance}
        </span>
        <span className={`text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-sm ${growthColor} ${growthBg} ml-auto flex items-center gap-1`}>
          {item.expectedGrowth >= 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {item.expectedGrowth >= 0 ? "+" : ""}{item.expectedGrowth.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ─── Mini News Card (minimized view) ─────────────────────────────
function MiniNewsCard({ item }: { item: AINewsItem }) {
  const growthColor = item.expectedGrowth >= 0 ? "text-bb-green" : "text-bb-red";
  const sentiment = item.sentiment || "neutral";
  const sentimentColor: Record<string, string> = {
    bullish: "text-emerald-400",
    bearish: "text-rose-400",
    neutral: "text-blue-400",
    alert: "text-amber-300",
  };
  const sentimentIcon: Record<string, string> = {
    bullish: "▲",
    bearish: "▼",
    neutral: "●",
    alert: "⚠",
  };

  return (
    <div className="px-2 py-1.5 border-b border-border/50 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-start gap-1.5">
        <span className={`text-[8px] shrink-0 mt-1 ${sentimentColor[sentiment]}`}>
          {sentimentIcon[sentiment]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-foreground leading-snug line-clamp-2 font-medium">
            {item.headline}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[9px] font-bold text-bb-orange">{item.companyId}</span>
            <span className={`text-[8px] font-bold uppercase ${sentimentColor[sentiment]}`}>{sentiment}</span>
            <span className={`text-[9px] font-bold tabular-nums ${growthColor} ml-auto`}>
              {item.expectedGrowth >= 0 ? "+" : ""}{item.expectedGrowth.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
