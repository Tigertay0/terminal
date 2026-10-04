# Rochambeau Finance Terminal: debut video

A 70-second, 30fps product debut built with [Remotion](https://www.remotion.dev). No voiceover: on-screen type carries the story, an original synth track and sound effects carry the pace, and every UI shot is a real screen recording of the app.

Rendered file: `out/rochambeau-debut-9x16.mp4` (1080×1920, for Reels, Shorts, TikTok). The same edit also renders at 16:9 (`npm run render:16x9`).

## Structure

| Path | What it is |
| --- | --- |
| `capture/capture.mjs` | Playwright script that drives the real app and records six clips into `public/footage/` |
| `capture/harness.mjs` | Mocked Supabase session + market data routes, local fonts, synthetic cursor, CDP screencast → MP4 |
| `capture/mock-data.mjs` | Deterministic quotes, charts, leaderboard and news so captures are reproducible offline |
| `public/footage/*.events.json` | Every click and keystroke the capture made, in video time (drives the sound effects) |
| `src/timeline.ts` | The edit: shots with trims and camera keys for both aspect ratios, captions, card timings |
| `src/Debut.tsx` | Renders the timeline; adapts window, captions and cards to 9:16 or 16:9 |
| `audio/generate.mjs` | Dependency-free Node synth that writes the music and the sound effects from the timeline |
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

## Sound

`audio/generate.mjs` writes `public/audio/soundtrack.mp3` (plus `music.mp3` and `sfx.mp3` stems) in a few seconds. Everything is synthesized, so there are no samples or licenses involved.

- **Music:** A minor, about 128.6 BPM, so one beat is exactly 14 frames, with the logo hit on bar 1. It moves from an intro drone to a groove when the window lands, breaks down under "Then, bend time.", returns busier through the simulation, and lands on one chord for the outro.
- **Sound effects:** keystrokes and clicks come from the capture's event logs mapped through each shot's trim, so they hit the exact frame. There are also whooshes on captions and transitions, impacts on the logo, stats and outro, rising blips on the speed chips, a chime on the trade and the event join, and a riser on 1DAY.
- **Master:** -14 LUFS integrated, -1 dBFS peak.

Re-run `npm run audio` after any timing change in `src/timeline.ts` or after a re-capture.

## Commands

```bash
npm install
npm run capture            # re-record all footage (starts the app's Vite dev server itself)
npm run capture -- sim     # re-record one clip: auth | dashboard | command | setup | sim | event
npm run audio              # regenerate music + sound effects from the timeline
npm run studio             # preview/scrub both compositions in Remotion Studio
npm run render             # → out/rochambeau-debut-9x16.mp4
npm run render:16x9        # → out/rochambeau-debut-16x9.mp4
```

Capture needs the root app's dependencies installed (`npm install` at the repo root). Rendering uses the preinstalled Playwright headless shell when present; set `REMOTION_BROWSER` to point at another Chromium.

Capture timing varies with machine load. After a re-capture, re-anchor each shot's `trim` in `src/timeline.ts` to the new `*.events.json` (the comments name the event and the local frame it should land on), then run `npm run audio`.
