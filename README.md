# Rochambeau Finance Terminal

A web-based market data workstation with real-time stock data and a full simulation mode.

- Real mode: live quotes, charts, market movers from Yahoo Finance
- Simulation mode: paper trading, time controls, news engine, tutorial, timed events with a leaderboard
- Accounts: your watchlist, simulation saves and event results persist across devices

Live at **https://terminal.tiger-tayo.workers.dev**

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui
- **Hosting**: one Cloudflare Worker. The built app is served as static assets; `/api/*` runs the Worker (Hono)
- **Database**: Neon Postgres (project `terminal`), reached through Cloudflare Hyperdrive
- **Accounts**: Better Auth (email + password, Google when configured), users stored in the same database
- **AI news**: Claude Haiku 5.5 writes simulation headlines for signed-in users

| Path | What it is |
|---|---|
| `src/` | The app |
| `worker/` | The API: `app.ts` (routing, sessions), `auth.ts` (Better Auth), `routes/` (market data, user data, AI news) |
| `shared/limits.ts` | Defaults and limits used by both sides (default watchlist, save cap) |
| `db/migrations/` | Database schema, applied in order by `npm run db:migrate` |
| `wrangler.jsonc` | Worker config: Hyperdrive binding, AI news rate limit, site address |

### API

| Route | Who | What |
|---|---|---|
| `GET /api/yf/quote?symbols=`, `/chart`, `/search` | anyone | Yahoo Finance data. Cached per Worker instance, and at the edge once the site has a custom domain (the Cache API does nothing on workers.dev). 600 requests a minute per address |
| `/api/auth/*` | anyone | Sign up, sign in, sign out, session (Better Auth). Sign-up and sign-in are rate limited per address |
| `GET /api/config` | anyone | Whether Google sign-in is available |
| `GET/PUT /api/watchlist` | signed in | The user's watchlist (a new account gets the default list on first read) |
| `GET/POST /api/saves`, `PUT/DELETE /api/saves/:id` | signed in | Simulation saves, up to 20 per user |
| `/api/events/...` | signed in | Join the event running now, report progress, finish, leaderboard, completed events |
| `POST /api/ai-news` | signed in | AI headlines (`mode: "headlines"`) or article bodies (`mode: "detailed"`). 5 a minute and 150 a day per user; 60 a minute and 3,000 a day for everyone |

Every user-data query filters on the signed-in user's id, so nobody can read or change another account's rows. Only the event running now can be joined, results can't change once an entry is completed, and the leaderboard only shows names, days and profit (plus which row is yours). Results are still computed in the browser, so a determined player could submit a made-up score, as with the old version.

## Local development

You need the Neon dev branch's connection string for the Worker's role, saved (outside git) as `.secrets/neon-dev-worker.url`. Then create `.dev.vars`:

```
BETTER_AUTH_URL=http://localhost:5173
BETTER_AUTH_SECRET=<any long random string>
ANTHROPIC_API_KEY=<optional, for AI news>
```

```bash
npm install
npm run dev
```

`npm run dev` serves the app and the API together on http://localhost:5173, using the dev database. Without `.secrets/neon-dev-worker.url`, market data still works but sign-in and saved data don't.

```bash
npm test
```

runs the API tests. The ownership and validation tests in `worker/test/db.test.ts` also need `.secrets/neon-dev-owner.url` (they create and then delete test accounts on the dev branch); without it they are skipped.

## Database

Neon project `terminal` (aws-us-east-1) has two branches: `main` (live) and `dev`. Schema changes are new files in `db/migrations/`, applied with the owner role's connection string:

```bash
node scripts/migrate.mjs .secrets/neon-dev-owner.url
node scripts/migrate.mjs .secrets/neon-main-owner.url
```

The Worker connects as `terminal_worker`, which can read and write rows but not change the schema (`db/migrations/0003_app_role.sql`, created by `scripts/create-worker-role.mjs`). Hyperdrive config `terminal` points at the `main` branch (`scripts/hyperdrive.mjs`).

## Deploy

```bash
npm run deploy
```

builds the app and deploys the Worker with `wrangler`. Secrets are set once with `npx wrangler secret put NAME`:

- `BETTER_AUTH_SECRET` (required)
- `ANTHROPIC_API_KEY` (AI news; without it the simulation uses its built-in news only)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (optional; the Google button appears once both are set. The OAuth client's redirect URI is `https://terminal.tiger-tayo.workers.dev/api/auth/callback/google`)

## Debut video

A Remotion project for the product debut video lives in [`video/`](video/README.md), including the capture scripts that record real app footage.
