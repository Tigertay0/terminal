import { createApp } from "../app";
import type { Env } from "../env";

export const SITE = "http://localhost:5173";

/** An env like the Worker's, pointed at `connectionString` (or nowhere). */
export function testEnv(connectionString = "postgres://nobody@127.0.0.1:1/none", overrides: Partial<Env> = {}): Env {
  return {
    HYPERDRIVE: { connectionString },
    NEWS_LIMITER: { limit: async () => ({ success: true }) },
    NEWS_GLOBAL_LIMITER: { limit: async () => ({ success: true }) },
    MARKET_LIMITER: { limit: async () => ({ success: true }) },
    BETTER_AUTH_URL: SITE,
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
    ...overrides,
  };
}

/** Calls the app the way the Workers runtime would, then waits for background work. */
export async function call(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => void pending.push(promise),
    passThroughOnException: () => {},
    props: {},
  } as unknown as ExecutionContext;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (init.method && init.method !== "GET" && !headers.has("origin")) headers.set("origin", SITE);
  const response = await createApp().request(path, { ...init, headers }, env, ctx);
  await Promise.allSettled(pending);
  return response;
}

export const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
