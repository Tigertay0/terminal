-- App data. Every row belongs to a user; the Worker's queries filter by the
-- signed-in user's id (this replaces Supabase's row-level security).

CREATE TABLE watchlists (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  symbols TEXT[] NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sim_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  portfolio JSONB NOT NULL DEFAULT '{}'::jsonb,
  watchlist TEXT[] NOT NULL DEFAULT '{}',
  day_number INTEGER NOT NULL DEFAULT 1,
  sim_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sim_saves_user_updated ON sim_saves (user_id, updated_at DESC);

CREATE TABLE event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Anonymous',
  current_day INTEGER NOT NULL DEFAULT 1,
  profit NUMERIC NOT NULL DEFAULT 0,
  portfolio JSONB,
  settings JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  final_stats JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_key, user_id)
);
-- Leaderboard: one event, best profit first.
CREATE INDEX idx_event_participants_board ON event_participants (event_key, profit DESC);
-- A user's completed events, newest first.
CREATE INDEX idx_event_participants_user_status ON event_participants (user_id, status, updated_at DESC);
