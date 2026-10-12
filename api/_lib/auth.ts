import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Public values (same as src/lib/supabase.ts). Only used to verify user access
// tokens, so no service-role key is needed.
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://jwqmzltyxlybyabyrcsx.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_l1Q9rVCknK2v9w8Hb5SkCg_z8_Vl0iF";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export function getBearerToken(req: Pick<VercelRequest, "headers">): string | null {
  const header = req.headers.authorization;
  const match = typeof header === "string" ? header.match(/^Bearer\s+(\S+)$/i) : null;
  return match ? match[1] : null;
}

/** Returns the Supabase user id for the request's bearer token, or null if missing/invalid. */
export async function getRequestUserId(req: Pick<VercelRequest, "headers">): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch (err: any) {
    console.error("Token verification failed:", err?.message || err);
    return null;
  }
}

/**
 * Sliding-window limiter keyed by user id. Best-effort only: serverless
 * instances don't share memory, so each warm instance counts separately and
 * the count resets on cold start.
 */
export function createRateLimiter(limit: number, windowMs: number, maxKeys = 1000) {
  const hits = new Map<string, number[]>();

  return function allow(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    const allowed = recent.length < limit;
    if (allowed) recent.push(now);

    hits.delete(key);
    if (hits.size >= maxKeys) {
      // Maps iterate in insertion order, so the first key is the least recently seen.
      const oldest = hits.keys().next().value;
      if (oldest !== undefined) hits.delete(oldest);
    }
    hits.set(key, recent);
    return allowed;
  };
}
