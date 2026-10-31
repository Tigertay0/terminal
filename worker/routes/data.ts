import { Hono, type Context } from "hono";
import { z } from "zod";
import {
  DEFAULT_WATCHLIST,
  MAX_SIM_SAVES,
  MAX_WATCHLIST_SYMBOLS,
  SYMBOL_PATTERN,
} from "../../shared/limits";
import type { AppEnv } from "../app";
import { PG, pgCode } from "../db";

/**
 * Each signed-in user's data: watchlist, simulation saves and event entries.
 *
 * Every statement filters on the session's user id, which is what Supabase's
 * row-level security used to enforce. The client never chooses whose rows it
 * touches.
 */

const uuid = z.string().uuid();
const eventKey = z.string().regex(/^[a-z0-9_-]{1,64}$/i);
const symbols = z.array(z.string().regex(SYMBOL_PATTERN)).max(MAX_WATCHLIST_SYMBOLS);
const jsonObject = z.record(z.unknown());
const finiteNumber = z.number().finite();
const day = z.number().int().min(0).max(1_000_000);

const savePayload = z.object({
  name: z.string().trim().min(1).max(80),
  settings: jsonObject,
  portfolio: jsonObject,
  watchlist: symbols,
  day_number: day,
  sim_time: z.string().datetime({ offset: true }),
});

const progressPayload = z.object({
  currentDay: day,
  profit: finiteNumber,
  portfolio: jsonObject,
});

const completePayload = progressPayload.extend({
  finalStats: jsonObject,
});

// Returned to the owner; profit is numeric in Postgres and a number in JSON.
const PARTICIPANT_COLUMNS = `id, event_key, user_id, display_name, current_day, profit::float8 AS profit,
  portfolio, settings, status, final_stats, created_at, updated_at`;

async function readJson<T>(c: Context<AppEnv>, schema: z.ZodType<T>): Promise<T | null> {
  const body = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

const invalid = (c: Context<AppEnv>) => c.json({ error: "Invalid request" }, 400);
const notFound = (c: Context<AppEnv>) => c.json({ error: "Not found" }, 404);

export const dataRoutes = new Hono<AppEnv>();

// ─── Watchlist ──────────────────────────────────────────────────

// The default list is created on first read, which replaces Supabase's sign-up trigger.
dataRoutes.get("/watchlist", async (c) => {
  const { rows } = await c.var.pool.query<{ symbols: string[] }>(
    `WITH created AS (
       INSERT INTO watchlists (user_id, symbols) VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING symbols
     )
     SELECT symbols FROM created
     UNION ALL
     SELECT symbols FROM watchlists WHERE user_id = $1
     LIMIT 1`,
    [c.var.user.id, DEFAULT_WATCHLIST],
  );
  return c.json({ symbols: rows[0]?.symbols ?? DEFAULT_WATCHLIST });
});

dataRoutes.put("/watchlist", async (c) => {
  const body = await readJson(c, z.object({ symbols }));
  if (!body) return invalid(c);
  await c.var.pool.query(
    `INSERT INTO watchlists (user_id, symbols, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET symbols = EXCLUDED.symbols, updated_at = now()`,
    [c.var.user.id, body.symbols],
  );
  return c.body(null, 204);
});

// ─── Simulation saves ───────────────────────────────────────────

dataRoutes.get("/saves", async (c) => {
  const { rows } = await c.var.pool.query(
    `SELECT id, user_id, name, settings, portfolio, watchlist, day_number, sim_time, updated_at
     FROM sim_saves WHERE user_id = $1 ORDER BY updated_at DESC`,
    [c.var.user.id],
  );
  return c.json(rows);
});

dataRoutes.post("/saves", async (c) => {
  const body = await readJson(c, savePayload);
  if (!body) return invalid(c);
  const client = await c.var.pool.connect();
  try {
    await client.query("BEGIN");
    // Serialises one user's inserts, so two tabs saving at once cannot both take the last slot.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sim_saves:' || $1))", [c.var.user.id]);
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO sim_saves (user_id, name, settings, portfolio, watchlist, day_number, sim_time)
       SELECT $1, $2, $3, $4, $5, $6, $7
       WHERE (SELECT count(*) FROM sim_saves WHERE user_id = $1) < $8
       RETURNING id`,
      [c.var.user.id, body.name, body.settings, body.portfolio, body.watchlist, body.day_number, body.sim_time, MAX_SIM_SAVES],
    );
    await client.query("COMMIT");
    if (!rows[0]) return c.json({ error: `You can keep up to ${MAX_SIM_SAVES} saves. Delete one first.` }, 409);
    return c.json({ id: rows[0].id }, 201);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
});

dataRoutes.put("/saves/:id", async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  const body = await readJson(c, savePayload);
  if (!id.success || !body) return invalid(c);
  const { rows } = await c.var.pool.query<{ id: string }>(
    `UPDATE sim_saves
     SET name = $3, settings = $4, portfolio = $5, watchlist = $6, day_number = $7, sim_time = $8, updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id.data, c.var.user.id, body.name, body.settings, body.portfolio, body.watchlist, body.day_number, body.sim_time],
  );
  return rows[0] ? c.json({ id: rows[0].id }) : notFound(c);
});

dataRoutes.delete("/saves/:id", async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  if (!id.success) return invalid(c);
  const { rowCount } = await c.var.pool.query(
    "DELETE FROM sim_saves WHERE id = $1 AND user_id = $2",
    [id.data, c.var.user.id],
  );
  return rowCount ? c.body(null, 204) : notFound(c);
});

// ─── Events ─────────────────────────────────────────────────────

dataRoutes.get("/events/completed", async (c) => {
  const { rows } = await c.var.pool.query(
    `SELECT ${PARTICIPANT_COLUMNS} FROM event_participants
     WHERE user_id = $1 AND status = 'completed'
     ORDER BY updated_at DESC`,
    [c.var.user.id],
  );
  return c.json(rows);
});

/** The signed-in user's entry in one event, or null. */
dataRoutes.get("/events/:eventKey/entry", async (c) => {
  const key = eventKey.safeParse(c.req.param("eventKey"));
  if (!key.success) return invalid(c);
  const { rows } = await c.var.pool.query(
    `SELECT ${PARTICIPANT_COLUMNS} FROM event_participants WHERE event_key = $1 AND user_id = $2`,
    [key.data, c.var.user.id],
  );
  return c.json(rows[0] ?? null);
});

// The leaderboard name is the account's display name, never one the client sends.
dataRoutes.post("/events/:eventKey/entry", async (c) => {
  const key = eventKey.safeParse(c.req.param("eventKey"));
  const body = await readJson(c, z.object({ settings: jsonObject }));
  if (!key.success || !body) return invalid(c);
  try {
    const { rows } = await c.var.pool.query(
      `INSERT INTO event_participants (event_key, user_id, display_name, settings)
       VALUES ($1, $2, $3, $4)
       RETURNING ${PARTICIPANT_COLUMNS}`,
      [key.data, c.var.user.id, c.var.user.name || "Anonymous", body.settings],
    );
    return c.json(rows[0], 201);
  } catch (error) {
    if (pgCode(error) === PG.uniqueViolation) return c.json({ error: "Already joined" }, 409);
    throw error;
  }
});

// Progress and results can only change while the entry is still active, so a
// finished result cannot be edited afterwards.
dataRoutes.patch("/events/entries/:id/progress", async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  const body = await readJson(c, progressPayload);
  if (!id.success || !body) return invalid(c);
  const { rowCount } = await c.var.pool.query(
    `UPDATE event_participants
     SET current_day = $3, profit = $4, portfolio = $5, updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'active'`,
    [id.data, c.var.user.id, body.currentDay, body.profit, body.portfolio],
  );
  return rowCount ? c.body(null, 204) : notFound(c);
});

dataRoutes.post("/events/entries/:id/complete", async (c) => {
  const id = uuid.safeParse(c.req.param("id"));
  const body = await readJson(c, completePayload);
  if (!id.success || !body) return invalid(c);
  const { rowCount } = await c.var.pool.query(
    `UPDATE event_participants
     SET status = 'completed', current_day = $3, profit = $4, portfolio = $5, final_stats = $6, updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'active'`,
    [id.data, c.var.user.id, body.currentDay, body.profit, body.portfolio, body.finalStats],
  );
  return rowCount ? c.body(null, 204) : notFound(c);
});

// Only the columns the leaderboard shows; other players' portfolios and settings stay private.
dataRoutes.get("/events/:eventKey/leaderboard", async (c) => {
  const key = eventKey.safeParse(c.req.param("eventKey"));
  if (!key.success) return invalid(c);
  const { rows } = await c.var.pool.query(
    `SELECT id, user_id, display_name, current_day, profit::float8 AS profit, status
     FROM event_participants WHERE event_key = $1
     ORDER BY profit DESC, updated_at ASC
     LIMIT 500`,
    [key.data],
  );
  return c.json(rows);
});
