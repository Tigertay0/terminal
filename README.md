# Bloomberg Terminal

A web-based Bloomberg-style terminal with real-time stock data and a full simulation mode.

- Real mode: live quotes, charts, market movers from Yahoo Finance
- Simulation mode: paper trading, time controls, news engine, tutorial
- Full authentication with Supabase — your watchlist and simulation saves persist across devices

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui
- **Backend**: Vercel serverless functions (Yahoo Finance proxy only)
- **Database & Auth**: Supabase (Postgres + Auth + Row-Level Security)

## Deploy to Vercel (5 minutes)

1. Go to [vercel.com/new](https://vercel.com/new) and import this repository.
2. **Framework Preset**: Vite (auto-detected)
3. **Environment Variables** — add these two:
   - `VITE_SUPABASE_URL` = `https://jwqmzltyxlybyabyrcsx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_l1Q9rVCknK2v9w8Hb5SkCg_z8_Vl0iF`
4. Click **Deploy**.

That's it. No database to provision — Supabase is already set up with the right tables and policies.

### One-time Supabase setting

In your Supabase dashboard → Authentication → Providers → Email, set **Confirm email** to **OFF** (or leave it ON if you want users to verify their email before logging in).

## Local development

```bash
npm install
echo "VITE_SUPABASE_URL=https://jwqmzltyxlybyabyrcsx.supabase.co" > .env.local
echo "VITE_SUPABASE_ANON_KEY=sb_publishable_l1Q9rVCknK2v9w8Hb5SkCg_z8_Vl0iF" >> .env.local
npm run dev
```

## Database schema

Tables (in Supabase, with RLS enforcing `auth.uid() = user_id`):

- `watchlists(user_id PK, symbols text[])` — one row per user
- `sim_saves(id, user_id, name, settings, portfolio, watchlist, day_number, sim_time)` — many per user

A trigger creates a default watchlist of 15 symbols on signup.
