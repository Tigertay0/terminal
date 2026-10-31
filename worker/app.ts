import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { Pool } from "pg";
import { createAuth, googleConfigured, isPublicAuthPath, type Auth } from "./auth";
import { BAD_INPUT_CODES, createPool, pgCode } from "./db";
import type { Env } from "./env";
import { dataRoutes } from "./routes/data";
import { newsRoutes } from "./routes/ai-news";
import { yahooRoutes } from "./routes/yahoo";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { pool: Pool; auth: Auth; user: SessionUser };
};

// Simulation saves carry the whole portfolio and trade history.
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_AUTH_BODY_BYTES = 16 * 1024;
// Better Auth's session cookie (with the __Secure- prefix on https).
const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?terminal\.session_token=/;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * A database pool and auth instance for this request. A Worker may not share
 * connections between requests, so both are built here and the pool is closed
 * once the response and any auth background work are done.
 */
const database = createMiddleware<AppEnv>(async (c, next) => {
  const pool = createPool(c.env.HYPERDRIVE.connectionString);
  const background: Promise<unknown>[] = [];
  // Background tasks can queue more tasks, so drain until none are left.
  const closeAfterBackground = async () => {
    while (background.length) await Promise.allSettled(background.splice(0));
    await pool.end();
  };
  try {
    c.set("pool", pool);
    c.set("auth", createAuth(c.env, pool, (task) => background.push(task)));
    await next();
  } finally {
    c.executionCtx.waitUntil(
      closeAfterBackground().catch((error) => console.warn(`[db] closing pool: ${(error as Error).message}`)),
    );
  }
});

/**
 * Cookie-authenticated writes must come from this site. Browsers always send
 * Origin on these methods; a request without one is not from a browser page.
 */
const sameOrigin = createMiddleware<AppEnv>(async (c, next) => {
  const origin = c.req.header("origin");
  if (UNSAFE_METHODS.has(c.req.method) && origin && origin !== new URL(c.env.BETTER_AUTH_URL).origin) {
    return c.json({ error: "Cross-site request refused" }, 403);
  }
  await next();
});

// Unknown auth paths answer 404 before any database work.
const knownAuthPath = createMiddleware<AppEnv>(async (c, next) => {
  if (!isPublicAuthPath(c.env, c.req.path)) return c.json({ error: "Not found" }, 404);
  await next();
});

// A request without a session cookie is answered before a database connection is opened.
const hasSessionCookie = createMiddleware<AppEnv>(async (c, next) => {
  if (!SESSION_COOKIE.test(c.req.header("cookie") ?? "")) return c.json({ error: "Sign in required" }, 401);
  await next();
});

const tooLarge = bodyLimit({
  maxSize: MAX_BODY_BYTES,
  onError: (c) => c.json({ error: "This save is too large to store." }, 413),
});

const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  let session: Awaited<ReturnType<Auth["api"]["getSession"]>>;
  try {
    session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  } catch (error) {
    console.error("Session check failed:", (error as Error)?.message || error);
    return c.json({ error: "Sign-in check unavailable. Try again shortly." }, 503);
  }
  if (!session) return c.json({ error: "Sign in required" }, 401);
  c.set("user", { id: session.user.id, name: session.user.name, email: session.user.email });
  await next();
});

export function createApp() {
  const app = new Hono<AppEnv>().basePath("/api");

  app.use("*", secureHeaders());
  app.route("/yf", yahooRoutes);

  // What the sign-in screen should offer.
  app.get("/config", (c) => c.json({ google: googleConfigured(c.env) }));

  app.use(
    "/auth/*",
    knownAuthPath,
    sameOrigin,
    bodyLimit({ maxSize: MAX_AUTH_BODY_BYTES, onError: (c) => c.json({ error: "Request too large" }, 413) }),
    database,
  );
  app.on(["GET", "POST"], "/auth/*", (c) => c.var.auth.handler(c.req.raw));

  // A trailing /* also matches the bare path, so "/saves/*" covers "/saves".
  for (const path of ["/watchlist", "/saves/*", "/events/*", "/ai-news"]) {
    app.use(path, sameOrigin, tooLarge, hasSessionCookie, database, requireUser);
  }
  app.route("/ai-news", newsRoutes);
  app.route("/", dataRoutes);

  app.notFound((c) => c.json({ error: "Not found" }, 404));
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    // Values Postgres cannot store (a NUL byte, an impossible date): the request is wrong.
    const code = pgCode(error);
    if (code && BAD_INPUT_CODES.has(code)) return c.json({ error: "Invalid request" }, 400);
    console.error(`[api] ${c.req.method} ${c.req.path}:`, error);
    return c.json({ error: "Something went wrong" }, 500);
  });

  return app;
}
