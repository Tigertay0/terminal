import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchChart, CHART_RANGES, CHART_INTERVALS } from "../_lib/yahoo.js";
import { applyCors } from "../_lib/cors.js";

const SYMBOL_PATTERN = /^[A-Z0-9.\-^=]{1,15}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    const symbol = String(req.query.symbol || "").trim().toUpperCase();
    const range = String(req.query.range || "6mo");
    const interval = String(req.query.interval || "1d");
    if (!symbol) return res.status(400).json({ error: "No symbol" });
    if (!SYMBOL_PATTERN.test(symbol)) return res.status(400).json({ error: "Invalid symbol" });
    if (!(CHART_RANGES as readonly string[]).includes(range)) return res.status(400).json({ error: "Invalid range" });
    if (!(CHART_INTERVALS as readonly string[]).includes(interval)) return res.status(400).json({ error: "Invalid interval" });

    const data = await fetchChart(symbol, range, interval);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Chart error:", err?.message || err);
    return res.status(502).json({ error: "Failed to fetch chart data" });
  }
}
