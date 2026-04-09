import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, ensureTables } from "../_lib/db.js";
import { getUserFromRequest, corsHeaders } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const auth = getUserFromRequest(req);
  if (!auth) return res.status(401).json({ error: "Not authenticated" });

  try {
    await ensureTables();
  } catch (err: any) {
    console.error("Table init error:", err);
    return res.status(500).json({ error: "DB init error" });
  }

  // GET — list saves
  if (req.method === "GET") {
    try {
      const result = await sql`
        SELECT id, name, settings, portfolio, watchlist, day_number, sim_time, updated_at 
        FROM sim_saves WHERE user_id = ${auth.userId} ORDER BY updated_at DESC
      `;
      return res.status(200).json({ saves: result.rows });
    } catch (err: any) {
      console.error("SimSave GET error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }

  // POST — create or update save
  if (req.method === "POST") {
    try {
      const { id, name, settings, portfolio, watchlist, dayNumber, simTime } = req.body || {};
      if (!settings || !portfolio) return res.status(400).json({ error: "settings and portfolio required" });

      if (id) {
        // Update existing
        await sql`
          UPDATE sim_saves 
          SET name = ${name || 'Default'}, settings = ${JSON.stringify(settings)}, 
              portfolio = ${JSON.stringify(portfolio)}, watchlist = ${watchlist || []},
              day_number = ${dayNumber || 1}, sim_time = ${simTime || new Date().toISOString()},
              updated_at = NOW()
          WHERE id = ${id} AND user_id = ${auth.userId}
        `;
        return res.status(200).json({ success: true, id });
      } else {
        // Create new
        const result = await sql`
          INSERT INTO sim_saves (user_id, name, settings, portfolio, watchlist, day_number, sim_time)
          VALUES (${auth.userId}, ${name || 'Default'}, ${JSON.stringify(settings)}, 
                  ${JSON.stringify(portfolio)}, ${watchlist || []}, ${dayNumber || 1}, 
                  ${simTime || new Date().toISOString()})
          RETURNING id
        `;
        return res.status(201).json({ success: true, id: result.rows[0].id });
      }
    } catch (err: any) {
      console.error("SimSave POST error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }

  // DELETE — delete save
  if (req.method === "DELETE") {
    try {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "id required" });
      await sql`DELETE FROM sim_saves WHERE id = ${id} AND user_id = ${auth.userId}`;
      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("SimSave DELETE error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
