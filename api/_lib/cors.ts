import type { VercelRequest, VercelResponse } from "@vercel/node";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Sets CORS headers for the public read-only market-data endpoints.
 * Returns true when the request was a preflight and has been answered.
 */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
