import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, ensureTables } from "../_lib/db.js";
import { getUserFromRequest, corsHeaders } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    await ensureTables();

    const auth = getUserFromRequest(req);
    if (!auth) return res.status(401).json({ error: "Not authenticated" });

    const result = await sql`SELECT id, email, display_name FROM users WHERE id = ${auth.userId}`;
    if (result.rows.length === 0) return res.status(401).json({ error: "User not found" });

    const user = result.rows[0];
    return res.status(200).json({
      user: { id: user.id, email: user.email, displayName: user.display_name },
    });
  } catch (err: any) {
    console.error("Me error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
