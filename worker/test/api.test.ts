import { describe, expect, it } from "vitest";
import { cleanDisplayName } from "../auth";
import { call, json, testEnv } from "./helpers";

// No database here: requests without a session never reach one.
const env = testEnv();

describe("signed-in routes", () => {
  const routes: [string, RequestInit?][] = [
    ["/api/watchlist"],
    ["/api/watchlist", json("PUT", { symbols: ["AAPL"] })],
    ["/api/saves"],
    ["/api/saves", json("POST", {})],
    ["/api/saves/00000000-0000-0000-0000-000000000000", json("PUT", {})],
    ["/api/saves/00000000-0000-0000-0000-000000000000", { method: "DELETE" }],
    ["/api/events/completed"],
    ["/api/events/launch_2026/entry"],
    ["/api/events/launch_2026/entry", json("POST", { settings: {} })],
    ["/api/events/launch_2026/leaderboard"],
    ["/api/events/entries/00000000-0000-0000-0000-000000000000/progress", json("PATCH", {})],
    ["/api/events/entries/00000000-0000-0000-0000-000000000000/complete", json("POST", {})],
    ["/api/ai-news", json("POST", { stocks: [] })],
  ];

  it.each(routes)("%s answers 401 without a session", async (path, init) => {
    const res = await call(env, path, init);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in required" });
  });

  it("refuses writes from another site before checking the session", async () => {
    const res = await call(env, "/api/watchlist", {
      ...json("PUT", { symbols: ["AAPL"] }),
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
  });

  it("refuses oversized bodies", async () => {
    const res = await call(env, "/api/saves", json("POST", { blob: "x".repeat(1024 * 1024 + 1) }));
    expect(res.status).toBe(413);
  });
});

describe("auth endpoints", () => {
  it("reports whether Google sign-in is configured", async () => {
    expect(await (await call(env, "/api/config")).json()).toEqual({ google: false });
    const withGoogle = testEnv(undefined, { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" });
    expect(await (await call(withGoogle, "/api/config")).json()).toEqual({ google: true });
  });

  it("cleans display names shown to other players", () => {
    expect(cleanDisplayName("  Ada\u0000 Lovelace\n ")).toBe("Ada Lovelace");
    expect(cleanDisplayName(undefined)).toBe("");
  });
});

describe("market data validation", () => {
  it.each([
    ["/api/yf/quote", "No symbols"],
    ["/api/yf/quote?symbols=;;,  ,", "No symbols"],
    ["/api/yf/chart", "No symbol"],
    ["/api/yf/chart?symbol=AAPL;DROP", "Invalid symbol"],
    ["/api/yf/chart?symbol=AAPL&range=10y", "Invalid range"],
    ["/api/yf/chart?symbol=AAPL&interval=2m", "Invalid interval"],
  ])("%s answers 400", async (path, error) => {
    const res = await call(env, path);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });

  it("answers an empty search with an empty list", async () => {
    const res = await call(env, "/api/yf/search?q=%20");
    expect(await res.json()).toEqual([]);
  });

  it("answers CORS preflight for market data", async () => {
    const res = await call(env, "/api/yf/quote", { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

it("answers unknown API paths with JSON 404", async () => {
  const res = await call(env, "/api/nope");
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: "Not found" });
});
