-- ============================================================
-- EVENT PARTICIPANTS TABLE — Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create the table
CREATE TABLE event_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Anonymous',
  current_day INTEGER NOT NULL DEFAULT 1,
  profit NUMERIC NOT NULL DEFAULT 0,
  portfolio JSONB,
  settings JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  final_stats JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_key, user_id)
);

-- 2. Enable Row Level Security
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Anyone authenticated can read the leaderboard
CREATE POLICY "Anyone can view leaderboard"
  ON event_participants FOR SELECT
  USING (true);

-- Users can only insert their own row
CREATE POLICY "Users insert own entry"
  ON event_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own row
CREATE POLICY "Users update own entry"
  ON event_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own completed events (cleanup)
CREATE POLICY "Users delete own entry"
  ON event_participants FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Enable Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE event_participants;

-- 5. Index for fast leaderboard queries
CREATE INDEX idx_event_participants_event_key ON event_participants(event_key);
CREATE INDEX idx_event_participants_user_id ON event_participants(user_id);
CREATE INDEX idx_event_participants_profit ON event_participants(event_key, profit DESC);
