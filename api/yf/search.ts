import type { VercelRequest, VercelResponse } from "@vercel/node";
import { searchStocks } from "../_lib/yahoo.js";
import { corsHeaders } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  try {
    const q = ((req.query.q as string) || "").trim();
    if (!q) return res.json([]);

    const data = await searchStocks(q);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Search error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
