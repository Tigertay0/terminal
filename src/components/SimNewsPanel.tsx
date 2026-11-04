import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { X, ChevronDown, RefreshCw, Search } from "lucide-react";
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

// ─── Helpers ─────────────────────────────────────────────────────
const LINK_ACTION = "text-xs text-dim hover:text-foreground underline-offset-2 hover:underline";
const CHIP_BASE = "h-7 px-2 rounded-md text-xs transition-colors";
const CHIP_ON = "bg-raised text-foreground";
const CHIP_OFF = "text-muted-foreground hover:text-foreground hover:bg-raised";
const FIELD = "h-7 bg-raised border border-border rounded-md px-2 text-xs text-foreground outline-none";

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function sentimentTextClass(sentiment: string): string {
  if (sentiment === "bullish") return "text-up";
  if (sentiment === "bearish") return "text-down";
  if (sentiment === "alert") return "text-down";
  return "text-muted-foreground";
}

function sentimentDotClass(sentiment: string): string {
  if (sentiment === "bullish") return "bg-up";
  if (sentiment === "bearish" || sentiment === "alert") return "bg-down";
  return "bg-muted-foreground";
}

function formatGrowth(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function SkeletonLines() {
  return (
    <div className="animate-pulse space-y-2 mb-3 max-w-4xl">
      <div className="h-3 bg-raised rounded w-full" />
      <div className="h-3 bg-raised rounded w-3/4" />
    </div>
  );
}

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
    }).sort((a, b) => {
      // Alerts always first
      if (a.sentiment === "alert" && b.sentiment !== "alert") return -1;
      if (b.sentiment === "alert" && a.sentiment !== "alert") return 1;
      return 0;
    });
  }, [aiNews, selectedCompanies, selectedSector, importanceFilter, growthRange]);

  const [showAll, setShowAll] = useState(false);
  const highItems = useMemo(() => {
    const items = aiNews.filter(i => i.importance === "high");
    // Sort alerts to the top
    return items.sort((a, b) => (a.sentiment === "alert" ? -1 : 0) - (b.sentiment === "alert" ? -1 : 0));
  }, [aiNews]);
  const displayedMinimized = showAll ? aiNews.slice(0, 20) : highItems.slice(0, 5);
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
    const filtersActive =
      selectedCompanies.size > 0 ||
      selectedSector !== "all" ||
      importanceFilter !== "all" ||
      growthRange[0] !== -30 ||
      growthRange[1] !== 30;

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="sim-news-expanded">
        {/* Header */}
        <div className="rf-panel-header shrink-0 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="rf-panel-title">Market news</span>
            <span className="num text-2xs text-muted-foreground">{filteredItems.length} / {aiNews.length}</span>
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 -mr-2"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Filter toolbar */}
        <div className="border-b border-border bg-card px-3 py-2 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-dim">Filters</span>
            {filtersActive && (
              <button onClick={clearFilters} className={`${LINK_ACTION} ml-auto`}>
                Clear all
              </button>
            )}
          </div>

          {/* Row 1: Sector + Importance */}
          <div className="flex items-center gap-2">
            <select
              value={selectedSector}
              onChange={e => setSelectedSector(e.target.value)}
              className={`${FIELD} w-32`}
            >
              <option value="all">All sectors</option>
              {uniqueSectors.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <div className="flex gap-1">
              {(["all", "high", "low"] as ImportanceFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setImportanceFilter(f)}
                  className={`${CHIP_BASE} ${importanceFilter === f ? CHIP_ON : CHIP_OFF}`}
                >
                  {capitalize(f)}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Company search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <input
              value={companySearch}
              onChange={e => setCompanySearch(e.target.value)}
              placeholder="Filter by company"
              className={`${FIELD} w-full pl-7 placeholder:text-muted-foreground`}
            />
          </div>

          {/* Company chips */}
          {(companySearch || selectedCompanies.size > 0) && (
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto rf-scrollbar">
              {filteredCompanies.map(c => (
                <button
                  key={c.symbol}
                  onClick={() => toggleCompany(c.symbol)}
                  className={`${CHIP_BASE} num ${selectedCompanies.has(c.symbol) ? CHIP_ON : CHIP_OFF}`}
                >
                  {c.symbol}
                </button>
              ))}
            </div>
          )}

          {/* Growth range slider */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-dim whitespace-nowrap">Growth</span>
            <span className="num text-xs text-down w-10 text-right">{growthRange[0]}%</span>
            <input
              type="range"
              min={-30}
              max={30}
              value={growthRange[0]}
              onChange={e => setGrowthRange([+e.target.value, growthRange[1]])}
              className="flex-1 h-1 accent-primary"
            />
            <input
              type="range"
              min={-30}
              max={30}
              value={growthRange[1]}
              onChange={e => setGrowthRange([growthRange[0], +e.target.value])}
              className="flex-1 h-1 accent-primary"
            />
            <span className="num text-xs text-up w-10">{growthRange[1]}%</span>
          </div>
        </div>

        {/* News list */}
        <div className="flex-1 overflow-y-auto rf-scrollbar">
          {loading && (
            <div className="space-y-4 px-3 py-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-3 bg-raised rounded w-3/4" />
                  <div className="h-3 bg-raised rounded w-full" />
                  <div className="h-3 bg-raised rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
              <div className="text-xs text-down font-medium">News failed to load</div>
              <div className="text-2xs text-muted-foreground">{error}</div>
              <button onClick={onRetry} className={`${LINK_ACTION} flex items-center gap-2`}>
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filteredItems.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              {aiNews.length > 0 ? "No items match your filters" : "No news yet"}
            </p>
          )}

          {detailsLoading && (
            <div className="px-3 py-2 border-b border-border/60 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" strokeWidth={1.5} />
              <span className="text-2xs text-muted-foreground">Loading articles…</span>
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
      className="rf-panel flex flex-col h-full cursor-pointer group"
      onClick={() => setExpanded(true)}
      data-testid="sim-news-minimized"
    >
      <div className="rf-panel-header">
        <span className="rf-panel-title">News</span>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); setShowAll(p => !p); }}
            className={`${CHIP_BASE} ${showAll ? CHIP_ON : CHIP_OFF}`}
          >
            {showAll ? "Top" : "All"}
          </button>
          <span className="text-2xs text-muted-foreground"><span className="num">{aiNews.length}</span> {aiNews.length === 1 ? "story" : "stories"}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.5} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rf-scrollbar">
        {loading && (
          <div className="space-y-3 px-3 py-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-3 bg-raised rounded w-4/5" />
                <div className="h-3 bg-raised rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center gap-1 py-4 px-3 text-center">
            <div className="text-xs text-down">News unavailable</div>
            <button
              onClick={e => { e.stopPropagation(); onRetry(); }}
              className={LINK_ACTION}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && aiNews.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground">Waiting for market news…</p>
        )}

        {!loading && !error &&
          displayedMinimized.map(item => (
            <MiniNewsCard key={item.id} item={item} />
          ))}

        {!loading && !error && moreCount > 0 && (
          <div className="px-3 py-2 text-center border-t border-border/60">
            <span className="text-xs text-dim">{moreCount} more stories</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── News Card (expanded) ────────────────────────────────────────
function NewsCard({ item, detailsLoading }: { item: AINewsItem; detailsLoading?: boolean }) {
  const growthColor = item.expectedGrowth >= 0 ? "text-up" : "text-down";
  const sentiment = item.sentiment || "neutral";
  const isAlert = sentiment === "alert";

  const meta = (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="num text-xs text-foreground font-medium">{item.companyId}</span>
      <span className="text-2xs text-muted-foreground">{item.sector}</span>
      <span className={`text-2xs ${item.importance === "high" ? "text-dim" : "text-muted-foreground"}`}>
        {item.importance === "high" ? "High impact" : "Low impact"}
      </span>
      <span className={`num text-xs ${growthColor}`}>{formatGrowth(item.expectedGrowth)}</span>
      {item.simDay && (
        <span className="num text-2xs text-muted-foreground ml-auto">
          Day {item.simDay}{item.simTimeStr ? ` · ${item.simTimeStr}` : ""}
        </span>
      )}
    </div>
  );

  const body = item.summary ? (
    <div className="text-xs text-dim leading-relaxed mb-3 max-w-4xl">{item.summary}</div>
  ) : detailsLoading ? (
    <SkeletonLines />
  ) : null;

  // Breaking news: calm row with a down-coloured left border
  if (isAlert) {
    return (
      <div className="bg-down/10 border-l-2 border-down border-b border-b-border/60 px-3 py-3">
        <div className="text-2xs font-medium text-down mb-1">Breaking</div>
        <div className="text-sm text-foreground leading-snug mb-2">{item.headline}</div>
        {body}
        {meta}
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-b border-border/60 hover:bg-raised/60 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sentimentDotClass(sentiment)}`} />
        <span className={`text-2xs ${sentimentTextClass(sentiment)}`}>{capitalize(sentiment)}</span>
      </div>
      <div className="text-sm text-foreground leading-snug mb-2">{item.headline}</div>
      {body}
      {meta}
    </div>
  );
}

// ─── Mini News Card (minimized view) ─────────────────────────────
function MiniNewsCard({ item }: { item: AINewsItem }) {
  const growthColor = item.expectedGrowth >= 0 ? "text-up" : "text-down";
  const sentiment = item.sentiment || "neutral";
  const isAlert = sentiment === "alert";

  return (
    <div
      className={`px-3 py-2 border-b border-border/60 hover:bg-raised/60 transition-colors ${
        isAlert ? "border-l-2 border-l-down" : ""
      }`}
    >
      <div className="text-xs text-foreground leading-snug line-clamp-2">{item.headline}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sentimentDotClass(sentiment)}`} />
        <span className="num text-2xs text-foreground font-medium">{item.companyId}</span>
        <span className={`text-2xs ${sentimentTextClass(sentiment)}`}>
          {isAlert ? "Breaking" : capitalize(sentiment)}
        </span>
        {item.simDay && (
          <span className="num text-2xs text-muted-foreground">
            D{item.simDay}{item.simTimeStr ? ` ${item.simTimeStr}` : ""}
          </span>
        )}
        <span className={`num text-2xs ${growthColor} ml-auto`}>{formatGrowth(item.expectedGrowth)}</span>
      </div>
    </div>
  );
}
