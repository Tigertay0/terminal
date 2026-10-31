// The signed-in user's saved data, through the Worker's /api routes. The
// session cookie identifies the user; the server decides whose rows are read.

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function api<T>(operation: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = (body && typeof body.error === "string" && body.error) || `HTTP ${res.status}`;
    console.error(`${operation} error`, res.status, message);
    throw new ApiError(`${operation} failed: ${message}`, res.status);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

// ─── Watchlist ──────────────────────────────────────────────────
/** The user's watchlist; a new account gets the default list on first read. */
export async function getWatchlist(): Promise<string[]> {
  const { symbols } = await api<{ symbols: string[] }>("getWatchlist", "/api/watchlist");
  return symbols;
}

export async function saveWatchlist(symbols: string[]): Promise<void> {
  await api("saveWatchlist", "/api/watchlist", json("PUT", { symbols }));
}

// ─── Sim Saves ──────────────────────────────────────────────────
export interface SimSaveRow {
  id: string;
  user_id: string;
  name: string;
  settings: any;
  portfolio: any;
  watchlist: string[];
  day_number: number;
  sim_time: string;
  updated_at: string;
}

export interface SimSavePayload {
  id?: string | null;
  name: string;
  settings: any;
  portfolio: any;
  watchlist: string[];
  day_number: number;
  sim_time: string;
}

export async function listSimSaves(): Promise<SimSaveRow[]> {
  return api<SimSaveRow[]>("listSimSaves", "/api/saves");
}

/** Updates the save with `payload.id`, or creates one; returns its id (null if it no longer exists). */
export async function upsertSimSave(payload: SimSavePayload): Promise<string | null> {
  const { id, ...row } = payload;
  if (id) {
    try {
      const updated = await api<{ id: string }>("upsertSimSave update", `/api/saves/${encodeURIComponent(id)}`, json("PUT", row));
      return updated.id;
    } catch (err) {
      // Deleted from another tab: nothing to update, so no id comes back.
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }
  const created = await api<{ id: string }>("upsertSimSave insert", "/api/saves", json("POST", row));
  return created.id;
}

export async function deleteSimSave(id: string) {
  await api("deleteSimSave", `/api/saves/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ─── Event Participants ─────────────────────────────────────────
export interface EventParticipantRow {
  id: string;
  event_key: string;
  user_id: string;
  display_name: string;
  current_day: number;
  profit: number;
  portfolio: any;
  settings: any;
  status: "active" | "completed";
  final_stats: any;
  created_at: string;
  updated_at: string;
}

const eventPath = (eventKey: string) => `/api/events/${encodeURIComponent(eventKey)}`;
const entryPath = (id: string) => `/api/events/entries/${encodeURIComponent(id)}`;

/** The user's entry in an event, or null if they haven't joined */
export async function getEventParticipant(eventKey: string): Promise<EventParticipantRow | null> {
  return api<EventParticipantRow | null>("getEventParticipant", `${eventPath(eventKey)}/entry`);
}

/** Join an event under the account's display name */
export async function joinEvent(eventKey: string, settings: any): Promise<EventParticipantRow> {
  return api<EventParticipantRow>("joinEvent", `${eventPath(eventKey)}/entry`, json("POST", { settings }));
}

/** Update progress during play */
export async function updateEventProgress(
  id: string,
  currentDay: number,
  profit: number,
  portfolio: any,
): Promise<void> {
  await api("updateEventProgress", `${entryPath(id)}/progress`, json("PATCH", { currentDay, profit, portfolio }));
}

/** Mark event as completed with final stats */
export async function completeEvent(
  id: string,
  profit: number,
  portfolio: any,
  currentDay: number,
  finalStats: any,
): Promise<void> {
  await api("completeEvent", `${entryPath(id)}/complete`, json("POST", { profit, portfolio, currentDay, finalStats }));
}

export type LeaderboardEntry = Pick<
  EventParticipantRow,
  "id" | "user_id" | "display_name" | "current_day" | "profit" | "status"
>;

/** Leaderboard for an event, best profit first */
export async function getEventLeaderboard(eventKey: string): Promise<LeaderboardEntry[]> {
  return api<LeaderboardEntry[]>("getEventLeaderboard", `${eventPath(eventKey)}/leaderboard`);
}

const LEADERBOARD_POLL_MS = 30_000;

/** Fetches the leaderboard now and every 30 s; returns a function that stops it. */
export function subscribeToLeaderboard(
  eventKey: string,
  callback: (participants: LeaderboardEntry[]) => void,
) {
  // Errors are already logged by getEventLeaderboard; keep the last good data on failure.
  const refresh = () => {
    getEventLeaderboard(eventKey).then(callback).catch(() => {});
  };
  refresh();
  const pollInterval = setInterval(refresh, LEADERBOARD_POLL_MS);
  return () => clearInterval(pollInterval);
}

/** The user's completed events, for the save tab */
export async function getCompletedEvents(): Promise<EventParticipantRow[]> {
  return api<EventParticipantRow[]>("getCompletedEvents", "/api/events/completed");
}
