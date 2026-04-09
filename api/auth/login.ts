import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { sql, ensureTables } from "../_lib/db.js";
import { signToken, corsHeaders } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    await ensureTables();

    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const result = await sql`SELECT id, email, password_hash, display_name FROM users WHERE email = ${email.toLowerCase()}`;
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid email or password" });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    const token = signToken({ userId: user.id, email: user.email });

    res.setHeader("Set-Cookie", `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);
    return res.status(200).json({
      user: { id: user.id, email: user.email, displayName: user.display_name },
      token,
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
