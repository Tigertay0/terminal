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
export interface SimSavePayload {
  id?: string | null;
  name: string;
  settings: any;
  portfolio: any;
  watchlist: string[];
  day_number: number;
  sim_time: string;
}

export async function listSimSaves(userId: string) {
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
