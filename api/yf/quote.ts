import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchQuotes } from "../_lib/yahoo.js";
import { applyCors } from "../_lib/cors.js";

const MAX_SYMBOLS = 30;
const MAX_SYMBOL_LENGTH = 15;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    const symbolsRaw = String(req.query.symbols || "");
    const symbols = symbolsRaw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && s.length <= MAX_SYMBOL_LENGTH);
    if (symbols.length === 0) return res.status(400).json({ error: "No symbols" });

    // Limit per request to avoid timeout
    const limited = symbols.slice(0, MAX_SYMBOLS);
    const data = await fetchQuotes(limited);

    // Cache for 10 seconds at CDN level
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Quote error:", err?.message || err);
    return res.status(502).json({ error: "Failed to fetch quotes" });
  }
}
