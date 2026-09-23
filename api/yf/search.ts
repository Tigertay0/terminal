import type { VercelRequest, VercelResponse } from "@vercel/node";
import { searchStocks } from "../_lib/yahoo.js";
import { applyCors } from "../_lib/cors.js";

const MAX_QUERY_LENGTH = 64;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    const q = String(req.query.q || "").trim().slice(0, MAX_QUERY_LENGTH);
    if (!q) return res.json([]);

    const data = await searchStocks(q);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Search error:", err?.message || err);
    return res.status(502).json({ error: "Search failed" });
  }
}
