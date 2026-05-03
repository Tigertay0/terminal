// ─── Template News Engine ────────────────────────────────────────
// Instant, pre-written news headlines that generate without any API call.
// Headlines are loaded from template-headlines.json and picked randomly.
// Impact is always < 5%.

import type { AINewsItem } from "./ai-news";

// ─── Template headline format (loaded from JSON) ─────────────────
export interface TemplateHeadline {
  headline: string;        // Use {company} and {ticker} as placeholders
  sentiment: "bullish" | "bearish" | "neutral";
  sector: string;          // "universal", "technology", "consumer", "healthcare", "financial", "energy", "industrial", "communications"
  impactRange: [number, number]; // e.g. [0.1, 2.5] — absolute percentage range (always < 5)
  importance: "high" | "low";
}

// ─── Fallback templates (used if JSON hasn't been loaded yet) ─────
const FALLBACK_TEMPLATES: TemplateHeadline[] = [
  { headline: "{company} announces internal restructuring of management team", sentiment: "neutral", sector: "universal", impactRange: [0.1, 1.0], importance: "low" },
  { headline: "{company} reports minor supply chain disruptions in Q3", sentiment: "bearish", sector: "universal", impactRange: [0.3, 1.5], importance: "low" },
  { headline: "{company} expands hiring across multiple divisions", sentiment: "bullish", sector: "universal", impactRange: [0.2, 1.2], importance: "low" },
  { headline: "{ticker} sees unusual options activity ahead of earnings", sentiment: "neutral", sector: "universal", impactRange: [0.5, 2.0], importance: "low" },
  { headline: "Analysts maintain hold rating on {company} citing stable outlook", sentiment: "neutral", sector: "universal", impactRange: [0.1, 0.5], importance: "low" },
  { headline: "{company} announces $500M share buyback program", sentiment: "bullish", sector: "universal", impactRange: [1.0, 3.0], importance: "high" },
  { headline: "{company} faces class-action lawsuit over workplace practices", sentiment: "bearish", sector: "universal", impactRange: [0.5, 2.5], importance: "low" },
  { headline: "{company} CFO sells $2M in shares through planned divestiture", sentiment: "bearish", sector: "universal", impactRange: [0.3, 1.5], importance: "low" },
  { headline: "{company} partners with industry leader on sustainability initiative", sentiment: "bullish", sector: "universal", impactRange: [0.2, 1.0], importance: "low" },
  { headline: "{company} opens new regional headquarters in Austin, TX", sentiment: "bullish", sector: "universal", impactRange: [0.1, 0.8], importance: "low" },
];

// ─── Loaded templates from JSON ──────────────────────────────────
let loadedTemplates: TemplateHeadline[] = [];
let templatesLoaded = false;

export async function loadTemplateHeadlines(): Promise<void> {
  if (templatesLoaded) return;
  try {
    const res = await fetch("/template-headlines.json");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        loadedTemplates = data;
        templatesLoaded = true;
      }
    }
  } catch {
    // Silently fall back to built-in templates
  }
}

function getTemplates(): TemplateHeadline[] {
  return loadedTemplates.length > 0 ? loadedTemplates : FALLBACK_TEMPLATES;
}

// ─── Pick random template for a stock ────────────────────────────
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateTemplateNews(
  symbol: string,
  companyName: string,
  sector: string,
): AINewsItem | null {
  // Only generate ~15% of the time per tick (keeps it rare enough to feel natural)
  if (Math.random() > 0.15) return null;

  const templates = getTemplates();

  // Filter by sector: use sector-specific + universal
  const normalizedSector = normalizeSector(sector);
  const eligible = templates.filter(t =>
    t.sector === "universal" || t.sector === normalizedSector
  );

  if (eligible.length === 0) return null;

  const template = pickRandom(eligible);

  // Fill in placeholders
  const headline = template.headline
    .replace(/\{company\}/g, companyName)
    .replace(/\{ticker\}/g, symbol);

  // Random impact within the template's range
  const [min, max] = template.impactRange;
  const impact = min + Math.random() * (max - min);
  // Apply direction based on sentiment
  const signedImpact = template.sentiment === "bearish" ? -impact : impact;

  return {
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    companyName,
    companyId: symbol,
    sector,
    headline,
    summary: "", // Template news don't need in-depth articles
    importance: template.importance,
    sentiment: template.sentiment,
    expectedGrowth: +signedImpact.toFixed(1),
    generatedAt: Date.now(),
  };
}

// ─── Normalize sector names ──────────────────────────────────────
function normalizeSector(sector: string): string {
  const s = sector.toLowerCase();
  if (s.includes("tech") || s.includes("software") || s.includes("semiconductor")) return "technology";
  if (s.includes("consumer") || s.includes("retail") || s.includes("apparel") || s.includes("food")) return "consumer";
  if (s.includes("health") || s.includes("pharma") || s.includes("biotech") || s.includes("medical")) return "healthcare";
  if (s.includes("financ") || s.includes("bank") || s.includes("insurance") || s.includes("capital")) return "financial";
  if (s.includes("energy") || s.includes("oil") || s.includes("gas") || s.includes("solar") || s.includes("utility")) return "energy";
  if (s.includes("industr") || s.includes("manufactur") || s.includes("aerospace") || s.includes("defense")) return "industrial";
  if (s.includes("communic") || s.includes("media") || s.includes("telecom") || s.includes("entertainment")) return "communications";
  return "universal";
}
