// ─── AI News Types & Service ─────────────────────────────────────
// Client-side module for fetching Perplexity-generated news

export interface AINewsItem {
  id: string;
  companyName: string;
  companyId: string;
  sector: string;
  headline: string;
  summary: string;
  importance: "high" | "low";
  sentiment: "bullish" | "bearish" | "neutral" | "alert";
  expectedGrowth: number; // percentage, e.g. 4.5 or -2.1
  generatedAt: number; // timestamp
  simDay?: number; // simulation day number
  simTimeStr?: string; // e.g. "10:35 AM"
}

export interface AINewsState {
  items: AINewsItem[];
  loading: boolean;
  error: string | null;
  lastFetchDay: number; // sim day when last fetched
}

interface StockInput {
  symbol: string;
  name: string;
  price: number;
  sector: string;
  marketCap: number;
}

// ─── localStorage persistence (scoped per save) ─────────────────
const NEWS_STORAGE_PREFIX = "bb_sim_ai_news";

function newsKey(saveId?: string | null): string {
  return saveId ? `${NEWS_STORAGE_PREFIX}_${saveId}` : NEWS_STORAGE_PREFIX;
}

export function saveNewsToStorage(items: AINewsItem[], saveId?: string | null) {
  try {
    localStorage.setItem(newsKey(saveId), JSON.stringify(items.slice(0, 100)));
  } catch { /* quota exceeded — silently ignore */ }
}

export function loadNewsFromStorage(saveId?: string | null): AINewsItem[] {
  try {
    const raw = localStorage.getItem(newsKey(saveId));
    if (!raw) return [];
    return JSON.parse(raw) as AINewsItem[];
  } catch {
    return [];
  }
}

export function clearNewsStorage(saveId?: string | null) {
  localStorage.removeItem(newsKey(saveId));
}

// ─── Fetch headlines only (fast — no summaries) ──────────────────
export async function fetchAINews(
  stocks: StockInput[],
  variation: string,
): Promise<AINewsItem[]> {
  // Only send top 5 stocks to keep the prompt small and fast
  const topStocks = stocks.slice(0, 5);

  // Retry up to 3 times (Vercel cold starts can cause 504s)
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/perplexity-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stocks: topStocks, variation, mode: "headlines" }),
      });

      if (res.status === 504) {
        lastError = new Error("Server timeout — retrying...");
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `API returned ${res.status}` }));
        throw new Error(err.error || `API returned ${res.status}`);
      }

      const raw = await res.json();
      const now = Date.now();

      return raw.map((item: any, idx: number) => ({
        ...item,
        summary: "", // no summary in headlines mode — loaded on demand
        id: `ai-${now}-${idx}`,
        generatedAt: now,
      }));
    } catch (err: any) {
      lastError = err;
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  throw lastError || new Error("Failed after 3 attempts");
}

// ─── Fetch detailed article bodies on demand ─────────────────────
export async function fetchAINewsDetails(
  items: AINewsItem[],
  stocks: StockInput[],
  variation: string,
): Promise<Map<string, string>> {
  // Only fetch for items that don't have summaries yet
  const needsDetail = items.filter(i => !i.summary);
  if (needsDetail.length === 0) return new Map();

  // Send headlines with index markers for reliable matching
  const headlines = needsDetail.map((i, idx) => `[${idx}] [${i.companyId}] ${i.headline}`);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("/api/perplexity-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stocks: stocks.slice(0, 5),
          variation,
          mode: "detailed",
          itemIds: headlines,
        }),
      });

      if (res.status === 504) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!res.ok) return new Map();

      const raw = await res.json();
      const detailMap = new Map<string, string>();

      // Match by index or by company ticker
      if (Array.isArray(raw)) {
        raw.forEach((detail: any, idx: number) => {
          // Try direct index mapping first
          if (idx < needsDetail.length && detail.summary) {
            detailMap.set(needsDetail[idx].id, String(detail.summary));
          }
        });
      }

      return detailMap;
    } catch (err: any) {
      lastError = err;
      if (attempt < 1) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return new Map();
}

// ─── Synthetic news for unexplained price moves ──────────────────
const SYNTHETIC_BULLISH = [
  "Sector momentum lifts {sym} alongside peer gains",
  "{sym} benefits from positive macro data and investor optimism",
  "Institutional buying pressure drives {sym} higher",
  "Options activity surges in {sym} suggesting bullish positioning",
  "{sym} rallies on strong sector-wide demand trends",
  "Technical breakout triggers algorithmic buying in {sym}",
];

const SYNTHETIC_BEARISH = [
  "Profit-taking weighs on {sym} after extended rally",
  "{sym} under pressure from broader market sell-off",
  "Risk-off sentiment drags {sym} lower with sector peers",
  "Large block trade in {sym} signals institutional repositioning",
  "{sym} declines on light volume amid macro uncertainty",
  "Sector rotation out of {sym}'s industry group accelerates",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSyntheticNews(
  symbol: string,
  companyName: string,
  sector: string,
  priceChangePct: number,
): AINewsItem {
  const isPositive = priceChangePct > 0;
  const templates = isPositive ? SYNTHETIC_BULLISH : SYNTHETIC_BEARISH;
  const headline = pickRandom(templates).replace("{sym}", symbol);

  return {
    id: `syn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    companyName,
    companyId: symbol,
    sector,
    headline,
    summary: `${symbol} moved ${priceChangePct > 0 ? "+" : ""}${priceChangePct.toFixed(1)}% driven by market forces. ${
      isPositive
        ? "Analysts see this as part of broader sector strength."
        : "Traders attribute the decline to sector-wide headwinds."
    }`,
    importance: Math.abs(priceChangePct) > 3 ? "high" : "low",
    sentiment: isPositive ? "bullish" : "bearish",
    expectedGrowth: +priceChangePct.toFixed(1),
    generatedAt: Date.now(),
  };
}

// ─── Coherence tracker ───────────────────────────────────────────
// Prevents contradictory intraday news for the same company
export class NewsCoherenceTracker {
  // Track the "sentiment direction" established for each company this day
  private companySentiment = new Map<string, "bullish" | "bearish" | "neutral">();
  private companyHeadlines = new Map<string, Set<string>>();

  reset() {
    this.companySentiment.clear();
    this.companyHeadlines.clear();
  }

  /** Record that a company got news with this sentiment */
  recordSentiment(companyId: string, sentiment: "bullish" | "bearish" | "neutral") {
    // Only set if not already established (first news of the day wins)
    if (!this.companySentiment.has(companyId)) {
      this.companySentiment.set(companyId, sentiment);
    }
  }

  /** Check if a news item's sentiment contradicts established direction */
  wouldContradict(companyId: string, sentiment: "bullish" | "bearish" | "neutral"): boolean {
    const existing = this.companySentiment.get(companyId);
    if (!existing || existing === "neutral" || sentiment === "neutral") return false;
    return existing !== sentiment;
  }

  /** Check if headline is too similar to existing ones */
  isDuplicateHeadline(companyId: string, headline: string): boolean {
    const existing = this.companyHeadlines.get(companyId);
    if (!existing) return false;
    // Simple similarity: check if any existing headline shares >60% words
    const words = new Set(headline.toLowerCase().split(/\s+/));
    for (const h of existing) {
      const hWords = h.toLowerCase().split(/\s+/);
      const overlap = hWords.filter((w) => words.has(w)).length;
      if (overlap / Math.max(words.size, hWords.length) > 0.6) return true;
    }
    return false;
  }

  recordHeadline(companyId: string, headline: string) {
    if (!this.companyHeadlines.has(companyId)) {
      this.companyHeadlines.set(companyId, new Set());
    }
    this.companyHeadlines.get(companyId)!.add(headline);
  }
}
