import { sql } from "@vercel/postgres";

// Initialize tables if they don't exist
export async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS watchlists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      symbols TEXT[] DEFAULT ARRAY['AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','JPM','V','UNH','BRK-B','JNJ','WMT','MA','PG'],
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sim_saves (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT DEFAULT 'Default',
      settings JSONB NOT NULL,
      portfolio JSONB NOT NULL,
      watchlist TEXT[],
      day_number INTEGER DEFAULT 1,
      sim_time TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

export { sql };
