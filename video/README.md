# Rochambeau Finance Terminal: debut video

A 70-second, 1920×1080, 30fps product debut built with [Remotion](https://www.remotion.dev). No voiceover: on-screen type carries the story, and every UI shot is a real screen recording of the app.

Rendered file: `out/rochambeau-debut.mp4`

## Structure

| Path | What it is |
| --- | --- |
| `capture/capture.mjs` | Playwright script that drives the real app and records six clips into `public/footage/` |
| `capture/harness.mjs` | Mocked Supabase session + market data routes, local fonts, synthetic cursor, CDP screencast → MP4 |
| `capture/mock-data.mjs` | Deterministic quotes, charts, leaderboard and news so captures are reproducible offline |
| `src/Debut.tsx` | The timeline: shot list with camera keyframes, captions, and full-screen cards |
| `src/scenes/` | Hook, logo reveal, "bend time" chapter card, stats, outro |
| `src/components/` | Browser window + virtual camera (`Footage`), captions, kinetic type, backdrop/grain |

## Storyboard

| Time | Beat |
| --- | --- |
| 0:00 | Hook: "Most people learn the market by losing real money." → "What if practice felt real?" |
| 0:05 | Logo: rock, paper, scissors shapes assemble, wordmark rises |
| 0:09 | Sign-in screen ("Welcome to Rochambeau"), window tilts into place |
| 0:12 | Live markets: watchlist, chart ranges, movers, sector map |
| 0:23 | Command bar: type a ticker, hit enter |
| 0:28 | Chapter card: "Then, bend time." |
| 0:32 | Simulation setup → buy NVDA → AI news feed → fast-forward at 1DAY speed |
| 0:53 | Live event: join from the banner, land on the leaderboard |
| 1:00 | Stats: 9 global indices · 4 time speeds · $0 at risk |
| 1:04 | Outro: lockup + "Play the market. Risk nothing." |

## Commands

```bash
npm install
npm run capture            # re-record all footage (starts the app's Vite dev server itself)
npm run capture -- sim     # re-record one clip: auth | dashboard | command | setup | sim | event
npm run studio             # preview/scrub in Remotion Studio
npm run render             # → out/rochambeau-debut.mp4
```

Capture needs the root app's dependencies installed (`npm install` at the repo root). Rendering uses the preinstalled Playwright headless shell when present; set `REMOTION_BROWSER` to point at another Chromium.

If you re-capture, check the click timestamps in each clip still line up with the `trim` values and camera keys in `src/Debut.tsx` (mouse paths are scripted, so drift is small but nonzero).
