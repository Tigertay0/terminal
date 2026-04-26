import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchChart } from "../_lib/yahoo.js";
import { corsHeaders } from "../_lib/cors.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  try {
    const symbol = ((req.query.symbol as string) || "").trim().toUpperCase();
    const range = (req.query.range as string) || "6mo";
    const interval = (req.query.interval as string) || "1d";
    if (!symbol) return res.status(400).json({ error: "No symbol" });

    const data = await fetchChart(symbol, range, interval);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Chart error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
