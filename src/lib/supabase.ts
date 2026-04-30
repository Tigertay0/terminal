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

// ─── Watchlist ──────────────────────────────────────────────────
export async function getWatchlist(userId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("watchlists")
    .select("symbols")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("getWatchlist error", error);
    return null;
  }
  return data?.symbols ?? null;
}

export async function saveWatchlist(userId: string, symbols: string[]): Promise<void> {
  const { error } = await supabase
    .from("watchlists")
    .upsert({ user_id: userId, symbols, updated_at: new Date().toISOString() });
  if (error) console.error("saveWatchlist error", error);
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
  if (error) console.error("listSimSaves error", error);
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
    if (error) {
      console.error("upsertSimSave update error", error);
      return null;
    }
    return data?.id ?? null;
  } else {
    const { data, error } = await supabase
      .from("sim_saves")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      console.error("upsertSimSave insert error", error);
      return null;
    }
    return data?.id ?? null;
  }
}

export async function deleteSimSave(userId: string, id: string) {
  const { error } = await supabase
    .from("sim_saves")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) console.error("deleteSimSave error", error);
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
  if (error) console.error("getEventParticipant error", error);
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
  if (error) {
    console.error("joinEvent error", error);
    return null;
  }
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
  if (error) console.error("updateEventProgress error", error);
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
  if (error) console.error("completeEvent error", error);
}

/** Fetch leaderboard for an event — ordered by profit desc */
export async function getEventLeaderboard(
  eventKey: string,
): Promise<EventParticipantRow[]> {
  const { data, error } = await supabase
    .from("event_participants")
    .select("*")
    .eq("event_key", eventKey)
    .order("profit", { ascending: false });
  if (error) console.error("getEventLeaderboard error", error);
  return data ?? [];
}

/** Subscribe to realtime leaderboard changes */
export function subscribeToLeaderboard(
  eventKey: string,
  callback: (participants: EventParticipantRow[]) => void,
) {
  // Initial fetch
  getEventLeaderboard(eventKey).then(callback);

  // Realtime subscription
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
      () => {
        // Re-fetch full leaderboard on any change (simplest approach)
        getEventLeaderboard(eventKey).then(callback);
      },
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
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
  if (error) console.error("getCompletedEvents error", error);
  return data ?? [];
}
