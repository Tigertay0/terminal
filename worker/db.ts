import { Pool } from "pg";

// A query that hangs fails after this long instead of leaving a request open.
const QUERY_TIMEOUT_MS = 15_000;
const CONNECT_TIMEOUT_MS = 10_000;
const EXPECTED_CLOSE = /^This socket has been closed\.?$/;

/**
 * A connection pool for one request.
 *
 * A Worker may not reuse a connection from another request, so each request
 * gets its own pool, ended once the response is sent. Hyperdrive keeps the
 * warm connections to Neon on the other side, so this is cheap.
 */
export function createPool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    // Workers allow six open connections at once.
    max: 5,
  });
  // An idle connection the server closes is replaced on next use; unhandled, the
  // error would crash the request.
  pool.on("error", (error) => {
    if (!EXPECTED_CLOSE.test(error.message)) console.warn(`[db] idle connection closed: ${error.message}`);
  });
  return pool;
}

/** Postgres error codes the API answers itself instead of with a 500. */
export const PG = {
  uniqueViolation: "23505",
} as const;

export function pgCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}
