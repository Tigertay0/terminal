-- Fixes from the security and database reviews.

-- Leaderboard values stay in a sane range (the API checks the same bounds).
ALTER TABLE event_participants
  ADD CONSTRAINT event_participants_profit_range CHECK (profit BETWEEN -1e12 AND 1e12),
  ADD CONSTRAINT event_participants_day_range CHECK (current_day BETWEEN 0 AND 1000000);

-- No route deletes users, accounts, watchlists or event entries, and Better
-- Auth's delete endpoints are closed, so the Worker does not need to.
REVOKE DELETE ON users, accounts, watchlists, event_participants FROM terminal_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- AI news calls per user per day, and for everyone per day: a hard ceiling on
-- what the Anthropic key can be made to spend.
CREATE TABLE ai_news_usage (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE ai_news_daily (
  day DATE PRIMARY KEY,
  calls INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_news_usage, ai_news_daily TO terminal_app;

-- Postgres cancels a slow statement before the Worker's 15 s client timeout
-- gives up on it, so locks are not held for a request that has gone away.
-- (The role is created after the first migrations on a new database; see
-- scripts/create-worker-role.mjs, which sets the same value.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'terminal_worker') THEN
    ALTER ROLE terminal_worker SET statement_timeout = '10s';
  END IF;
END $$;
