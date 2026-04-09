import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { sql, ensureTables } from "../_lib/db.js";
import { signToken, corsHeaders } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  if (req.method === "OPTIONS") return res.status(200).json({});
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    await ensureTables();

    const { email, password, displayName } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    // Check existing user
    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
    if (existing.rows.length > 0) return res.status(409).json({ error: "Account already exists" });

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO users (email, password_hash, display_name) 
      VALUES (${email.toLowerCase()}, ${passwordHash}, ${displayName || email.split("@")[0]})
      RETURNING id, email, display_name
    `;
    const user = result.rows[0];

    // Create default watchlist
    await sql`INSERT INTO watchlists (user_id) VALUES (${user.id})`;

    // Generate token
    const token = signToken({ userId: user.id, email: user.email });

    res.setHeader("Set-Cookie", `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`);
    return res.status(201).json({
      user: { id: user.id, email: user.email, displayName: user.display_name },
      token,
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
