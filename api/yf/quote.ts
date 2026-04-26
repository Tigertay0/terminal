import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchQuotes } from "../_lib/yahoo.js";
import { corsHeaders } from "../_lib/cors.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  try {
    const symbolsRaw = (req.query.symbols as string) || "";
    const symbols = symbolsRaw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (symbols.length === 0) return res.status(400).json({ error: "No symbols" });

    // Limit to 30 per request to avoid timeout
    const limited = symbols.slice(0, 30);
    const data = await fetchQuotes(limited);

    // Cache for 10 seconds at CDN level
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Quote error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
