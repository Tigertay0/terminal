import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureTables } from "./_lib/db.js";
import { corsHeaders } from "./_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  try {
    await ensureTables();
    return res.status(200).json({ success: true, message: "Tables initialized" });
  } catch (err: any) {
    console.error("Init error:", err);
    return res.status(500).json({ error: err.message });
  }
}
