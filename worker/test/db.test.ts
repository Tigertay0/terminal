import { existsSync, readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_SIM_SAVES } from "../../shared/limits";
import { call, json, testEnv } from "./helpers";

/**
 * Runs the API against the Neon dev branch as the Worker's own role, with real
 * accounts, to check that each user only ever reaches their own rows.
 * Needs .secrets/neon-dev-worker.url and .secrets/neon-dev-owner.url (or the
 * TEST_DATABASE_URL / TEST_OWNER_DATABASE_URL variables); skipped without them.
 */

function secret(variable: string, file: string): string | null {
  if (process.env[variable]) return process.env[variable]!;
  const path = `.secrets/${file}`;
  return existsSync(path) ? readFileSync(path, "utf8").trim() : null;
}

const workerUrl = secret("TEST_DATABASE_URL", "neon-dev-worker.url");
const ownerUrl = secret("TEST_OWNER_DATABASE_URL", "neon-dev-owner.url");
const run = Boolean(workerUrl && ownerUrl);
const env = testEnv(workerUrl ?? undefined);
const tag = `dbtest-${Date.now()}`;
const emails: string[] = [];

const SAVE = {
  name: "Test save",
  settings: { startingCash: 100000 },
  portfolio: { cash: 100000, holdings: [] },
  watchlist: ["AAPL"],
  day_number: 1,
  sim_time: "2026-10-31T14:30:00.000Z",
};

async function signUp(name: string): Promise<string> {
  const email = `${tag}-${name}@example.com`;
  emails.push(email);
  const res = await call(env, "/api/auth/sign-up/email", json("POST", { email, password: "correct-horse-9", name }));
  expect(res.status, await res.clone().text()).toBe(200);
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  expect(cookie).toContain("terminal.session_token");
  return cookie;
}

function as(cookie: string, path: string, init: RequestInit = {}) {
  return call(env, path, { ...init, headers: { ...(init.headers as Record<string, string>), cookie } });
}

async function body<T>(response: Promise<Response>): Promise<T> {
  return (await (await response).json()) as T;
}

describe.skipIf(!run)("data access against the dev database", () => {
  let alice = "";
  let bob = "";
  let aliceSave = "";
  let aliceEntry = "";
  const eventKey = `${tag}-event`;

  beforeAll(async () => {
    alice = await signUp("alice");
    bob = await signUp("bob");
    aliceSave = (await body<{ id: string }>(as(alice, "/api/saves", json("POST", SAVE)))).id;
    aliceEntry = (await body<{ id: string }>(as(alice, `/api/events/${eventKey}/entry`, json("POST", { settings: { startingCash: 1 } })))).id;
  });

  afterAll(async () => {
    if (!run || emails.length === 0) return;
    const owner = new Client({ connectionString: ownerUrl! });
    await owner.connect();
    // Cascades to sessions, accounts, watchlists, saves and event entries.
    await owner.query("DELETE FROM users WHERE email = ANY($1)", [emails]);
    await owner.end();
  });

  it("gives a new account the default watchlist, then keeps its own", async () => {
    const first = await body<{ symbols: string[] }>(as(bob, "/api/watchlist"));
    expect(first.symbols).toContain("AAPL");
    expect((await as(bob, "/api/watchlist", json("PUT", { symbols: ["TSLA", "^GSPC"] }))).status).toBe(204);
    expect(await body(as(bob, "/api/watchlist"))).toEqual({ symbols: ["TSLA", "^GSPC"] });
    expect((await body<{ symbols: string[] }>(as(alice, "/api/watchlist"))).symbols).not.toEqual(["TSLA", "^GSPC"]);
  });

  it("never shows or changes another user's saves", async () => {
    expect(await body(as(bob, "/api/saves"))).toEqual([]);
    expect((await as(bob, `/api/saves/${aliceSave}`, json("PUT", SAVE))).status).toBe(404);
    expect((await as(bob, `/api/saves/${aliceSave}`, { method: "DELETE" })).status).toBe(404);
    const aliceSaves = await body<{ id: string; name: string }[]>(as(alice, "/api/saves"));
    expect(aliceSaves.map((s) => s.id)).toEqual([aliceSave]);
    expect(aliceSaves[0]!.name).toBe(SAVE.name);
  });

  it("validates save input", async () => {
    expect((await as(alice, "/api/saves/not-a-uuid", json("PUT", SAVE))).status).toBe(400);
    expect((await as(alice, "/api/saves", json("POST", { ...SAVE, name: "" }))).status).toBe(400);
    expect((await as(alice, "/api/saves", json("POST", { ...SAVE, sim_time: "yesterday" }))).status).toBe(400);
    expect((await as(alice, "/api/saves", json("POST", { ...SAVE, watchlist: ["not a symbol"] }))).status).toBe(400);
    expect((await as(alice, "/api/saves", { method: "POST", body: "{nope" })).status).toBe(400);
  });

  it(`caps saves at ${MAX_SIM_SAVES} per user, even when saved at once`, async () => {
    const statuses = await Promise.all(
      Array.from({ length: MAX_SIM_SAVES + 2 }, () => as(bob, "/api/saves", json("POST", SAVE)).then((r) => r.status)),
    );
    expect(statuses.filter((s) => s === 201)).toHaveLength(MAX_SIM_SAVES);
    expect(statuses.filter((s) => s === 409)).toHaveLength(2);
  });

  it("joins an event once, under the account's display name", async () => {
    expect((await as(alice, `/api/events/${eventKey}/entry`, json("POST", { settings: {} }))).status).toBe(409);
    const entry = await body<{ display_name: string; profit: number }>(as(alice, `/api/events/${eventKey}/entry`));
    expect(entry.display_name).toBe("alice");
    expect(entry.profit).toBe(0);
    expect(await body(as(bob, `/api/events/${eventKey}/entry`))).toBeNull();
  });

  it("lets only the owner update an entry, and only while it is active", async () => {
    const progress = { currentDay: 2, profit: 1234.5, portfolio: {} };
    const entry = `/api/events/entries/${aliceEntry}`;
    expect((await as(bob, `${entry}/progress`, json("PATCH", progress))).status).toBe(404);
    expect((await as(bob, `${entry}/complete`, json("POST", { ...progress, finalStats: {} }))).status).toBe(404);
    expect((await as(alice, `${entry}/progress`, json("PATCH", progress))).status).toBe(204);
    expect((await as(alice, `${entry}/complete`, json("POST", { ...progress, profit: 2000, finalStats: { trades: 3 } }))).status).toBe(204);
    expect((await as(alice, `${entry}/progress`, json("PATCH", { ...progress, profit: 999999 }))).status).toBe(404);

    expect(await body(as(alice, "/api/events/completed"))).toEqual([expect.objectContaining({ id: aliceEntry, profit: 2000 })]);
    expect(await body(as(bob, "/api/events/completed"))).toEqual([]);
  });

  it("shows other players only the leaderboard's own columns", async () => {
    const board = await body<Record<string, unknown>[]>(as(bob, `/api/events/${eventKey}/leaderboard`));
    expect(board).toHaveLength(1);
    expect(Object.keys(board[0]!).sort()).toEqual(["current_day", "display_name", "id", "profit", "status", "user_id"]);
    expect(board[0]!.profit).toBe(2000);
  });

  it("keeps auth endpoints the app does not use closed", async () => {
    for (const path of ["/api/auth/update-user", "/api/auth/delete-user", "/api/auth/list-sessions", "/api/auth/sign-in/social"]) {
      expect((await as(alice, path, json("POST", {}))).status, path).toBe(404);
    }
  });

  it("rejects display names longer than leaderboards allow", async () => {
    const email = `${tag}-long@example.com`;
    emails.push(email);
    const res = await call(env, "/api/auth/sign-up/email", json("POST", { email, password: "correct-horse-9", name: "x".repeat(41) }));
    expect(res.status).toBe(400);
  });

  it("ends the session on sign-out", async () => {
    expect((await as(bob, "/api/auth/sign-out", json("POST", {}))).status).toBe(200);
    expect((await as(bob, "/api/watchlist")).status).toBe(401);
  });
});
