import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://jwqmzltyxlybyabyrcsx.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_l1Q9rVCknK2v9w8Hb5SkCg_z8_Vl0iF";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

function throwDbError(operation: string, error: { message: string }): never {
  console.error(`${operation} error`, error);
  throw new Error(`${operation} failed: ${error.message}`);
}

// ─── Watchlist ──────────────────────────────────────────────────
export async function getWatchlist(userId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("watchlists")
    .select("symbols")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throwDbError("getWatchlist", error);
  return data?.symbols ?? null;
}

export async function saveWatchlist(userId: string, symbols: string[]): Promise<void> {
  const { error } = await supabase
    .from("watchlists")
    .upsert({ user_id: userId, symbols, updated_at: new Date().toISOString() });
  if (error) throwDbError("saveWatchlist", error);
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

export async function listSimSaves(userId: string): Promise<SimSaveRow[]> {
  const { data, error } = await supabase
    .from("sim_saves")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throwDbError("listSimSaves", error);
  return data ?? [];
}

export async function upsertSimSave(userId: string, payload: SimSavePayload): Promise<string | null> {
  const row = {
    user_id: userId,
    name: payload.name,
    settings: payload.settings,
    portfolio: payload.portfolio,
    watchlist: payload.watchlist,
    day_number: payload.day_number,
    sim_time: payload.sim_time,
    updated_at: new Date().toISOString(),
  };

  if (payload.id) {
    const { data, error } = await supabase
      .from("sim_saves")
      .update(row)
      .eq("id", payload.id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) throwDbError("upsertSimSave update", error);
    return data?.id ?? null;
  } else {
    const { data, error } = await supabase
      .from("sim_saves")
      .insert(row)
      .select("id")
      .single();
    if (error) throwDbError("upsertSimSave insert", error);
    return data?.id ?? null;
  }
}

export async function deleteSimSave(userId: string, id: string) {
  const { error } = await supabase
    .from("sim_saves")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throwDbError("deleteSimSave", error);
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

/** Check if a user already joined an event */
export async function getEventParticipant(
  eventKey: string,
  userId: string,
): Promise<EventParticipantRow | null> {
  const { data, error } = await supabase
    .from("event_participants")
    .select("*")
    .eq("event_key", eventKey)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throwDbError("getEventParticipant", error);
  return data ?? null;
}

/** Join an event — creates a new participant row */
export async function joinEvent(
  eventKey: string,
  userId: string,
  displayName: string,
  settings: any,
): Promise<EventParticipantRow | null> {
  const { data, error } = await supabase
    .from("event_participants")
    .insert({
      event_key: eventKey,
      user_id: userId,
      display_name: displayName,
      settings,
      current_day: 1,
      profit: 0,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throwDbError("joinEvent", error);
  return data;
}

/** Update progress during play */
export async function updateEventProgress(
  id: string,
  currentDay: number,
  profit: number,
  portfolio: any,
): Promise<void> {
  const { error } = await supabase
    .from("event_participants")
    .update({
      current_day: currentDay,
      profit,
      portfolio,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throwDbError("updateEventProgress", error);
}

/** Mark event as completed with final stats */
export async function completeEvent(
  id: string,
  profit: number,
  portfolio: any,
  currentDay: number,
  finalStats: any,
): Promise<void> {
  const { error } = await supabase
    .from("event_participants")
    .update({
      status: "completed",
      profit,
      portfolio,
      current_day: currentDay,
      final_stats: finalStats,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throwDbError("completeEvent", error);
}

export type LeaderboardEntry = Pick<
  EventParticipantRow,
  "id" | "user_id" | "display_name" | "current_day" | "profit" | "status"
>;

/** Fetch leaderboard for an event — ordered by profit desc */
export async function getEventLeaderboard(
  eventKey: string,
): Promise<LeaderboardEntry[]> {
  // Only the columns the leaderboard shows; other players' portfolios and settings stay out of the response.
  const { data, error } = await supabase
    .from("event_participants")
    .select("id, user_id, display_name, current_day, profit, status")
    .eq("event_key", eventKey)
    .order("profit", { ascending: false });
  if (error) throwDbError("getEventLeaderboard", error);
  return data ?? [];
}

/** Subscribe to realtime leaderboard changes + polling fallback */
export function subscribeToLeaderboard(
  eventKey: string,
  callback: (participants: LeaderboardEntry[]) => void,
) {
  // Errors are already logged by getEventLeaderboard; keep the last good data on failure.
  const refresh = () => {
    getEventLeaderboard(eventKey).then(callback).catch(() => {});
  };

  // Initial fetch
  refresh();

  // Polling fallback — refresh every 30s regardless of realtime
  const pollInterval = setInterval(refresh, 30_000);

  // Realtime subscription (fires on any INSERT/UPDATE/DELETE)
  const channel = supabase
    .channel(`event_leaderboard_${eventKey}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "event_participants",
        filter: `event_key=eq.${eventKey}`,
      },
      refresh,
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    clearInterval(pollInterval);
    supabase.removeChannel(channel);
  };
}

/** Fetch user's completed events for the save tab */
export async function getCompletedEvents(
  userId: string,
): Promise<EventParticipantRow[]> {
  const { data, error } = await supabase
    .from("event_participants")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("updated_at", { ascending: false });
  if (error) throwDbError("getCompletedEvents", error);
  return data ?? [];
}
