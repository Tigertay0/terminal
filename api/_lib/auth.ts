import jwt from "jsonwebtoken";
import type { VercelRequest } from "@vercel/node";

const JWT_SECRET = process.env.JWT_SECRET || "bloomberg-terminal-secret-change-in-production";

export interface TokenPayload {
  userId: number;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: VercelRequest): TokenPayload | null {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return verifyToken(token);
  }

  // Check cookie
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/token=([^;]+)/);
  if (match) {
    return verifyToken(match[1]);
  }

  return null;
}

// CORS headers for API routes
export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
