// Deterministic market + account data so the real app renders without
// Yahoo Finance or Supabase access during capture.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (str) => [...str].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

// symbol: [name, price, change %, market cap (B), pe, sector, avg volume (M)]
const BOOK = {
  AAPL: ["Apple Inc.", 254.63, 1.42, 3790, 38.6, "Technology", 52],
  MSFT: ["Microsoft Corporation", 517.35, 0.87, 3845, 37.9, "Technology", 21],
  GOOGL: ["Alphabet Inc.", 244.9, 2.31, 2965, 26.1, "Technology", 34],
  AMZN: ["Amazon.com, Inc.", 222.17, -0.64, 2370, 34.2, "Consumer Cyclical", 41],
  NVDA: ["NVIDIA Corporation", 187.24, 3.12, 4555, 53.4, "Technology", 182],
  TSLA: ["Tesla, Inc.", 459.46, -2.18, 1480, 248.1, "Consumer Cyclical", 98],
  META: ["Meta Platforms, Inc.", 727.05, 1.06, 1830, 26.4, "Technology", 12],
  JPM: ["JPMorgan Chase & Co.", 312.8, 0.48, 862, 15.6, "Financial Services", 9],
  V: ["Visa Inc.", 344.21, -0.31, 668, 33.5, "Financial Services", 7],
  UNH: ["UnitedHealth Group", 351.62, -1.74, 318, 15.2, "Healthcare", 14],
  "BRK-B": ["Berkshire Hathaway Inc.", 498.11, 0.22, 1075, 16.8, "Financial Services", 4],
  JNJ: ["Johnson & Johnson", 186.4, 0.61, 449, 19.9, "Healthcare", 8],
  WMT: ["Walmart Inc.", 103.25, 0.94, 823, 38.7, "Consumer Defensive", 17],
  MA: ["Mastercard Incorporated", 571.9, -0.12, 520, 38.4, "Financial Services", 3],
  PG: ["Procter & Gamble Co.", 152.33, -0.45, 357, 23.6, "Consumer Defensive", 7],
  BAC: ["Bank of America Corp.", 51.42, 1.21, 381, 14.9, "Financial Services", 38],
  GS: ["Goldman Sachs Group", 794.6, 1.88, 243, 17.4, "Financial Services", 2],
  MS: ["Morgan Stanley", 158.73, 1.35, 254, 17.9, "Financial Services", 6],
  PFE: ["Pfizer Inc.", 24.9, -0.88, 141, 13.1, "Healthcare", 41],
  ABBV: ["AbbVie Inc.", 229.14, 0.73, 405, 109.1, "Healthcare", 6],
  MRK: ["Merck & Co., Inc.", 84.12, -1.12, 211, 12.9, "Healthcare", 13],
  XOM: ["Exxon Mobil Corporation", 113.48, -0.96, 484, 16.1, "Energy", 15],
  CVX: ["Chevron Corporation", 155.27, -1.31, 311, 19.7, "Energy", 8],
  COP: ["ConocoPhillips", 94.66, -1.58, 118, 12.6, "Energy", 7],
  HD: ["The Home Depot, Inc.", 405.3, 0.39, 403, 27.5, "Consumer Cyclical", 4],
  NKE: ["NIKE, Inc.", 71.84, -2.46, 106, 33.1, "Consumer Cyclical", 12],
  SLB: ["Schlumberger Limited", 34.95, -2.07, 52, 12.0, "Energy", 14],
  EOG: ["EOG Resources, Inc.", 116.2, -0.74, 64, 11.3, "Energy", 3],
  AMD: ["Advanced Micro Devices", 164.67, 4.21, 267, 96.4, "Technology", 48],
  NFLX: ["Netflix, Inc.", 1214.25, 1.64, 516, 51.2, "Communication Services", 3],
  PLTR: ["Palantir Technologies", 182.39, 5.37, 431, 588.3, "Technology", 71],
  WFC: ["Wells Fargo & Company", 82.64, 0.92, 268, 14.2, "Financial Services", 15],
  C: ["Citigroup Inc.", 101.37, 1.47, 189, 14.8, "Financial Services", 14],
  BLK: ["BlackRock, Inc.", 1162.4, 0.66, 180, 28.3, "Financial Services", 1],
  SCHW: ["Charles Schwab Corp.", 95.18, -0.58, 173, 25.6, "Financial Services", 9],
  AXP: ["American Express Company", 331.25, 0.81, 231, 23.4, "Financial Services", 3],
  CRM: ["Salesforce, Inc.", 241.6, -0.94, 231, 36.8, "Technology", 7],
  ORCL: ["Oracle Corporation", 288.9, 2.75, 813, 66.7, "Technology", 22],
  INTC: ["Intel Corporation", 36.42, 3.86, 159, null, "Technology", 120],
  LLY: ["Eli Lilly and Company", 812.3, 1.12, 769, 53.1, "Healthcare", 4],
  AMGN: ["Amgen Inc.", 284.15, -0.42, 153, 23.2, "Healthcare", 3],
  GILD: ["Gilead Sciences, Inc.", 112.9, 0.35, 140, 22.7, "Healthcare", 7],
  BMY: ["Bristol-Myers Squibb", 45.2, -0.71, 92, 17.4, "Healthcare", 13],
  MDT: ["Medtronic plc", 95.4, 0.28, 122, 26.1, "Healthcare", 6],
  OXY: ["Occidental Petroleum", 46.8, -1.22, 46, 18.9, "Energy", 10],
  HAL: ["Halliburton Company", 24.7, -1.64, 21, 10.2, "Energy", 11],
  MPC: ["Marathon Petroleum", 182.3, -0.53, 56, 21.5, "Energy", 2],
  PSX: ["Phillips 66", 133.6, -0.37, 54, 30.2, "Energy", 3],
  VLO: ["Valero Energy", 164.9, 0.44, 51, 33.8, "Energy", 3],
};

const INDICES = {
  "^GSPC": ["S&P 500", 6688.46, 0.62],
  "^DJI": ["Dow Jones Industrial", 46441.1, 0.31],
  "^IXIC": ["NASDAQ Composite", 22780.51, 1.04],
  "^RUT": ["Russell 2000", 2436.48, -0.27],
  "^VIX": ["CBOE Volatility", 16.29, -4.12],
  "^FTSE": ["FTSE 100", 9427.73, 0.18],
  "^N225": ["Nikkei 225", 44932.63, 0.87],
  "^HSI": ["Hang Seng Index", 26855.56, -0.43],
  "^GDAXI": ["DAX Performance", 24113.62, 0.52],
};

export function quote(symbol) {
  const r = rng(hash(symbol));
  if (INDICES[symbol]) {
    const [name, price, pct] = INDICES[symbol];
    const change = +(price * pct / 100).toFixed(2);
    return { symbol, name, price, change, changesPercentage: pct, volume: 0, marketCap: 0, pe: null,
      dayHigh: price * 1.004, dayLow: price * 0.993, open: price - change * 0.6, previousClose: +(price - change).toFixed(2),
      yearHigh: price * 1.02, yearLow: price * 0.78, eps: null, avgVolume: 0, sector: "", exchange: "INDEX", quoteType: "INDEX" };
  }
  const row = BOOK[symbol];
  if (!row) return null;
  const [name, price, pct, capB, pe, sector, avgM] = row;
  const change = +(price * pct / (100 + pct)).toFixed(2);
  const prev = +(price - change).toFixed(2);
  const avgVolume = Math.round(avgM * 1e6);
  return {
    symbol, name, price, change, changesPercentage: pct,
    volume: Math.round(avgVolume * (0.7 + r() * 0.9)),
    marketCap: capB * 1e9, pe, dayHigh: +(Math.max(price, prev) * (1 + r() * 0.012)).toFixed(2),
    dayLow: +(Math.min(price, prev) * (1 - r() * 0.012)).toFixed(2), open: +(prev * (1 + (r() - 0.5) * 0.01)).toFixed(2),
    previousClose: prev, yearHigh: +(price * (1.04 + r() * 0.2)).toFixed(2), yearLow: +(price * (0.58 + r() * 0.2)).toFixed(2),
    eps: pe ? +(price / pe).toFixed(2) : null, avgVolume, sector,
    exchange: ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "AMD", "NFLX", "INTC", "AMGN", "GILD", "PLTR"].includes(symbol) ? "NasdaqGS" : "NYSE",
    quoteType: "EQUITY",
  };
}

const RANGE_DAYS = { "1d": 1, "5d": 5, "1mo": 22, "3mo": 64, "6mo": 128, "1y": 252, "2y": 504, "5y": 1260 };

export function chart(symbol, range = "6mo") {
  const q = quote(symbol);
  if (!q) return [];
  const n = RANGE_DAYS[range] ?? 128;
  const r = rng(hash(symbol + range));
  // Trend direction follows the day's move so charts agree with the quote color
  const drift = Math.sign(q.changesPercentage || 1) * (0.0022 + r() * 0.0016);
  const vol = q.quoteType === "INDEX" ? 0.006 : 0.008 + r() * 0.005;
  // Walk backwards from today's close so the series ends at the quote price
  const closes = [q.price];
  for (let i = 1; i < n; i++) {
    const shock = (r() + r() + r() - 1.5) * vol * 1.6;
    closes.push(closes[i - 1] / (1 + drift + shock));
  }
  closes.reverse();
  const bars = [];
  const day = new Date("2026-10-02T00:00:00Z");
  const dates = [];
  while (dates.length < n) {
    const wd = day.getUTCDay();
    if (wd !== 0 && wd !== 6) dates.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() - 1);
  }
  dates.reverse();
  for (let i = 0; i < n; i++) {
    const close = closes[i];
    const open = i === 0 ? close * (1 - (r() - 0.5) * vol) : closes[i - 1] * (1 + (r() - 0.5) * vol * 0.5);
    const high = Math.max(open, close) * (1 + r() * vol * 0.8);
    const low = Math.min(open, close) * (1 - r() * vol * 0.8);
    bars.push({ date: dates[i], open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2),
      volume: Math.round((q.avgVolume || 5e6) * (0.6 + r() * 0.9)) });
  }
  return bars;
}

export function search(q) {
  const s = q.toUpperCase();
  return Object.entries(BOOK)
    .filter(([sym, row]) => sym.startsWith(s) || row[0].toUpperCase().includes(s))
    .slice(0, 8)
    .map(([sym, row]) => ({ symbol: sym, name: row[0], type: "EQUITY", exchange: quote(sym).exchange }));
}

export const USER = {
  id: "7f3c1a52-1d4e-4b8a-9c61-0e2f5d8a4b17",
  aud: "authenticated",
  role: "authenticated",
  email: "demo@rochambeau.finance",
  email_confirmed_at: "2026-09-01T12:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { display_name: "Demo" },
  created_at: "2026-09-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function session() {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const access_token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER.id, aud: "authenticated", role: "authenticated", exp, email: USER.email })}.capture`;
  return { access_token, token_type: "bearer", expires_in: 60 * 60 * 24 * 30, expires_at: exp, refresh_token: "capture-refresh", user: USER };
}

export const WATCHLIST = ["AAPL", "NVDA", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "JPM", "GS", "MS", "BAC", "V", "XOM", "UNH", "WMT", "HD"];

export function leaderboard(eventKey) {
  const names = ["quantqueen", "Demo", "theta_gang", "lucasm", "bullish_on_bread", "ines.v", "mkt_maker_99", "deepvalue", "gamma_ray", "noah_k"];
  const profits = [18432.5, 14210.75, 11980.2, 9620.4, 7210.0, 5480.35, 2215.6, -840.15, -2310.9, -4120.0];
  return names.map((n, i) => ({ id: `p${i}`, user_id: i === 1 ? USER.id : `u${i}`, display_name: n, current_day: 100 - i * 3, profit: profits[i], status: i < 4 ? "completed" : "active", event_key: eventKey }));
}

// Headlines the sim's AI news panel would normally get from the news API
const HEADLINES = [
  ["NVIDIA Corporation", "NVDA", "Technology", "NVIDIA lands multi-year sovereign AI deal worth $40B across three Gulf states", "high", "bullish", 4.8],
  ["Apple Inc.", "AAPL", "Technology", "Apple's on-device AI drives record upgrade cycle as iPhone 18 preorders top forecasts", "high", "bullish", 3.1],
  ["Tesla, Inc.", "TSLA", "Consumer Cyclical", "Tesla recalls 380,000 vehicles over steering software fault; regulators open probe", "high", "alert", -4.6],
  ["JPMorgan Chase & Co.", "JPM", "Financial Services", "JPMorgan raises net interest income guidance on stronger loan growth", "low", "bullish", 1.9],
  ["Exxon Mobil Corporation", "XOM", "Energy", "Crude slides 3% as OPEC+ signals faster output increases into Q1", "low", "bearish", -2.2],
  ["UnitedHealth Group", "UNH", "Healthcare", "UnitedHealth medical cost ratio jumps again, shares under pressure", "high", "bearish", -3.4],
  ["Microsoft Corporation", "MSFT", "Technology", "Azure growth re-accelerates to 41% as capacity constraints ease", "low", "bullish", 2.3],
  ["Goldman Sachs Group", "GS", "Financial Services", "Goldman advisory fees surge as M&A pipeline hits three-year high", "low", "bullish", 2.0],
  ["Amazon.com, Inc.", "AMZN", "Consumer Cyclical", "Amazon faces FTC scrutiny over marketplace fee changes", "low", "neutral", -0.6],
  ["Walmart Inc.", "WMT", "Consumer Defensive", "Walmart same-store sales beat as higher-income shoppers trade down", "low", "bullish", 1.4],
  ["Meta Platforms, Inc.", "META", "Technology", "Meta's ad pricing climbs 14% as AI-ranked Reels lift engagement", "low", "bullish", 2.6],
  ["Pfizer Inc.", "PFE", "Healthcare", "Pfizer obesity pill misses primary endpoint in late-stage trial", "high", "alert", -6.1],
  ["Bank of America Corp.", "BAC", "Financial Services", "Bank of America lifts buyback to $40B after clearing stress test", "low", "bullish", 1.7],
  ["Chevron Corporation", "CVX", "Energy", "Chevron cuts 2027 capex as refining margins compress", "low", "bearish", -1.8],
  ["Alphabet Inc.", "GOOGL", "Technology", "Alphabet wins dismissal of key claim in search antitrust appeal", "high", "bullish", 3.3],
  ["NIKE, Inc.", "NKE", "Consumer Cyclical", "Nike guides holiday revenue lower on weak China foot traffic", "low", "bearish", -3.0],
  ["Visa Inc.", "V", "Financial Services", "Visa cross-border volumes steady; stablecoin settlement pilot expands", "low", "neutral", 0.4],
  ["The Home Depot, Inc.", "HD", "Consumer Cyclical", "Home Depot sees pro-contractor demand rebound as mortgage rates ease", "low", "bullish", 1.6],
  ["Morgan Stanley", "MS", "Financial Services", "Morgan Stanley wealth unit adds record $96B in net new assets", "low", "bullish", 1.8],
  ["Merck & Co., Inc.", "MRK", "Healthcare", "FDA delays decision on Merck's subcutaneous Keytruda", "low", "bearish", -2.1],
];
// Procedural extras so long fast-forward runs never repeat a headline
const NEWS_COMPANIES = [
  ["Apple Inc.", "AAPL", "Technology"], ["Microsoft Corporation", "MSFT", "Technology"], ["NVIDIA Corporation", "NVDA", "Technology"],
  ["Alphabet Inc.", "GOOGL", "Technology"], ["Amazon.com, Inc.", "AMZN", "Consumer Cyclical"], ["Meta Platforms, Inc.", "META", "Technology"],
  ["Tesla, Inc.", "TSLA", "Consumer Cyclical"], ["JPMorgan Chase & Co.", "JPM", "Financial Services"], ["Goldman Sachs Group", "GS", "Financial Services"],
  ["Exxon Mobil Corporation", "XOM", "Energy"], ["UnitedHealth Group", "UNH", "Healthcare"], ["Walmart Inc.", "WMT", "Consumer Defensive"],
  ["Johnson & Johnson", "JNJ", "Healthcare"], ["The Home Depot, Inc.", "HD", "Consumer Cyclical"], ["Mastercard Incorporated", "MA", "Financial Services"],
];
const NEWS_TEMPLATES = [
  ["{n} beats quarterly estimates on {seg} strength, lifts full-year outlook", "high", "bullish", 3.4],
  ["{n} announces ${b}B buyback as free cash flow hits record", "low", "bullish", 1.6],
  ["Analysts cut {n} price targets after {seg} slowdown", "low", "bearish", -1.9],
  ["{n} CFO departs unexpectedly; search for successor underway", "high", "alert", -3.1],
  ["{n} expands {seg} partnership in multi-year deal", "low", "bullish", 1.2],
  ["Regulators probe {n} over {seg} disclosures", "high", "alert", -2.7],
];
const SEGMENTS = ["cloud", "services", "data center", "consumer", "international", "subscription", "advertising", "logistics", "wholesale", "payments"];
for (let t = 0; t < NEWS_TEMPLATES.length; t++) {
  for (let c = 0; c < NEWS_COMPANIES.length; c++) {
    const [name, sym, sector] = NEWS_COMPANIES[(c * 7 + t * 4) % NEWS_COMPANIES.length];
    const [tpl, importance, sentiment, growth] = NEWS_TEMPLATES[t];
    const headline = tpl.replace("{n}", name.replace(/,? Inc\.|Corporation|Incorporated|Group|& Co\./g, "").trim())
      .replace("{seg}", SEGMENTS[(c + t * 3) % SEGMENTS.length]).replace("{b}", String(5 + ((c * 3 + t) % 20)));
    HEADLINES.push([name, sym, sector, headline, importance, sentiment, +(growth * (0.7 + ((c * 13) % 7) / 10)).toFixed(1)]);
  }
}
// Interleave so neighbouring stories never share a template (step is coprime with the pool size)
{
  const extras = HEADLINES.splice(20);
  for (let i = 0; i < extras.length; i++) HEADLINES.push(extras[(i * 7) % extras.length]);
}
let newsCursor = 0;

export function aiNews() {
  // Rotate through the pool so successive fetches bring fresh stories
  const batch = Array.from({ length: 5 }, (_, i) => HEADLINES[(newsCursor + i) % HEADLINES.length]);
  newsCursor += 5;
  return batch.map(([companyName, companyId, sector, headline, importance, sentiment, expectedGrowth]) => ({ companyName, companyId, sector, headline, importance, sentiment, expectedGrowth }));
}
