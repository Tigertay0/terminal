import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, ensureTables } from "../_lib/db.js";
import { getUserFromRequest, corsHeaders } from "../_lib/auth.js";

const DEFAULT_SYMBOLS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM",
  "V", "UNH", "BRK-B", "JNJ", "WMT", "MA", "PG"
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const auth = getUserFromRequest(req);

  // GET — return watchlist
  if (req.method === "GET") {
    if (!auth) return res.status(200).json({ symbols: DEFAULT_SYMBOLS });

    try {
      await ensureTables();
      const result = await sql`SELECT symbols FROM watchlists WHERE user_id = ${auth.userId}`;
      if (result.rows.length === 0) {
        await sql`INSERT INTO watchlists (user_id) VALUES (${auth.userId})`;
        return res.status(200).json({ symbols: DEFAULT_SYMBOLS });
      }
      return res.status(200).json({ symbols: result.rows[0].symbols });
    } catch (err: any) {
      console.error("Watchlist GET error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }

  // PUT — update watchlist
  if (req.method === "PUT") {
    if (!auth) return res.status(401).json({ error: "Not authenticated" });

    try {
      await ensureTables();
      const { symbols } = req.body || {};
      if (!Array.isArray(symbols)) return res.status(400).json({ error: "symbols must be an array" });

      await sql`
        INSERT INTO watchlists (user_id, symbols, updated_at) 
        VALUES (${auth.userId}, ${symbols}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET symbols = ${symbols}, updated_at = NOW()
      `;
      return res.status(200).json({ symbols });
    } catch (err: any) {
      console.error("Watchlist PUT error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
