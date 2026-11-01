-- terminal_app: what the Worker may do. It reads and writes rows; it cannot
-- change the schema. The login role Hyperdrive uses (terminal_worker, made by
-- scripts/create-worker-role.mjs) is a member of it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'terminal_app') THEN
    CREATE ROLE terminal_app NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO terminal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, sessions, accounts, verifications, auth_rate_limits,
  watchlists, sim_saves, event_participants
TO terminal_app;
