// ─── Timeline (frames @ 30fps) ───────────────────────────────────
// Single source of truth for the edit. Debut.tsx renders it; audio/generate.mjs
// reads it to place sound effects on the exact frames where things happen.
// Footage shots play inside one persistent browser window; full-screen cards
// (hook, logo, chapter break, stats, outro) cut over it. Shots run past the
// start of the card above them so its fade-in never reveals an empty window.

export const FPS = 30;
export const DURATION = 2106;
export const WIN_START = 258;
export const WIN_END = 1935;

// Camera keyframe: focus point in source pixels (1920×1080 capture) + zoom.
// Landscape: z = 1 shows the whole screen. Vertical: z = 1 fills the window's
// height, so the camera always crops to the action.
export type CamKey = { at: number; x: number; y: number; z: number };
export type HighlightSpec = { x: number; y: number; w: number; h: number; delay: number; label?: string };
// quiet: the camera is away from the cursor, so input events get no sound effects
export type Shot = { from: number; dur: number; src: string; trim: number; keys: CamKey[]; vkeys: CamKey[]; highlights?: HighlightSpec[]; quiet?: boolean };

// Trims are anchored to the input events logged next to each clip
// (public/footage/<clip>.events.json); comments give the event and its local frame.
export const SHOTS: Shot[] = [
  // Sign-in: "Welcome to Rochambeau" picks up straight from the logo (typing from local 21)
  {
    from: 258, dur: 90, src: "auth", trim: 1.0,
    keys: [{ at: 0, x: 960, y: 390, z: 2.1 }, { at: 90, x: 960, y: 430, z: 1.6 }],
    vkeys: [{ at: 0, x: 960, y: 420, z: 1.5 }, { at: 90, x: 960, y: 450, z: 1.3 }],
  },
  // Live markets: pick NVDA from the watchlist (click at local 36)
  {
    from: 348, dur: 105, src: "dashboard", trim: 0.8,
    keys: [{ at: 0, x: 960, y: 540, z: 1 }, { at: 32, x: 500, y: 330, z: 1.75 }, { at: 105, x: 500, y: 330, z: 1.85 }],
    vkeys: [{ at: 0, x: 900, y: 540, z: 1 }, { at: 26, x: 415, y: 540, z: 1 }, { at: 105, x: 300, y: 330, z: 1.25 }],
  },
  // Change the chart range (6M click at local 8)
  {
    from: 453, dur: 84, src: "dashboard", trim: 4.45,
    keys: [{ at: 0, x: 1420, y: 210, z: 1.9 }, { at: 40, x: 920, y: 320, z: 1.6 }, { at: 84, x: 900, y: 320, z: 1.5 }],
    vkeys: [{ at: 0, x: 1500, y: 300, z: 1.2 }, { at: 40, x: 1100, y: 540, z: 1 }, { at: 84, x: 1000, y: 540, z: 1 }],
  },
  // Losers tab (local 30), sector map, jump to TSLA (local 97), pull back
  {
    from: 537, dur: 147, src: "dashboard", trim: 11.1,
    keys: [{ at: 0, x: 640, y: 800, z: 1.7 }, { at: 34, x: 640, y: 800, z: 1.7 }, { at: 70, x: 1150, y: 800, z: 1.7 }, { at: 96, x: 1150, y: 800, z: 1.7 }, { at: 132, x: 960, y: 540, z: 1 }],
    vkeys: [{ at: 0, x: 500, y: 800, z: 1.2 }, { at: 34, x: 500, y: 800, z: 1.2 }, { at: 70, x: 1330, y: 800, z: 1.2 }, { at: 96, x: 1330, y: 800, z: 1.2 }, { at: 132, x: 800, y: 540, z: 1 }],
    highlights: [{ x: 1002, y: 562, w: 656, h: 318, delay: 64, label: "SECTOR MAP" }],
  },
  // Command bar: PLTR (keys from local 9, Enter 44), then AMD (Enter 160)
  {
    from: 684, dur: 180, src: "command", trim: 1.74,
    keys: [{ at: 0, x: 300, y: 1060, z: 3.0 }, { at: 40, x: 300, y: 1060, z: 3.0 }, { at: 80, x: 900, y: 420, z: 1.3 }, { at: 180, x: 900, y: 440, z: 1.25 }],
    vkeys: [{ at: 0, x: 190, y: 1000, z: 2.2 }, { at: 40, x: 190, y: 1000, z: 2.2 }, { at: 80, x: 600, y: 540, z: 1 }, { at: 180, x: 620, y: 540, z: 1 }],
    highlights: [{ x: 6, y: 1054, w: 600, h: 24, delay: 2 }],
  },
  // Simulation setup: $100,000 (local 38), HIGH (74), Start (115)
  {
    from: 948, dur: 150, src: "setup", trim: 4.75,
    keys: [{ at: 0, x: 960, y: 520, z: 1.9 }, { at: 118, x: 960, y: 530, z: 1.95 }, { at: 150, x: 960, y: 540, z: 1.2 }],
    vkeys: [{ at: 0, x: 960, y: 530, z: 1.4 }, { at: 118, x: 960, y: 530, z: 1.45 }, { at: 150, x: 960, y: 540, z: 1 }],
  },
  // Buy NVDA: trade tab (local 18), 150 shares (64–75), BUY (117)
  {
    from: 1098, dur: 180, src: "sim", trim: 2.54,
    keys: [{ at: 0, x: 1500, y: 330, z: 1.25 }, { at: 22, x: 1720, y: 300, z: 2.5 }, { at: 180, x: 1720, y: 300, z: 2.6 }],
    vkeys: [{ at: 0, x: 1400, y: 400, z: 1.2 }, { at: 22, x: 1740, y: 300, z: 2.2 }, { at: 180, x: 1740, y: 300, z: 2.25 }],
  },
  // AI news feed, once fast-forwarding has filled it with stories
  {
    from: 1278, dur: 105, src: "sim", trim: 12.4, quiet: true,
    keys: [{ at: 0, x: 1790, y: 800, z: 1.9 }, { at: 105, x: 1790, y: 780, z: 2.1 }],
    vkeys: [{ at: 0, x: 1760, y: 800, z: 2.0 }, { at: 105, x: 1760, y: 790, z: 2.1 }],
  },
  // Fast-forward: 1DAY click (local 24), end on the sim clock racing ahead
  {
    from: 1383, dur: 195, src: "sim", trim: 9.02,
    keys: [{ at: 0, x: 640, y: 60, z: 2.2 }, { at: 38, x: 640, y: 60, z: 2.2 }, { at: 78, x: 960, y: 540, z: 1 }, { at: 140, x: 960, y: 540, z: 1 }, { at: 185, x: 560, y: 160, z: 2.0 }],
    vkeys: [{ at: 0, x: 480, y: 300, z: 1.45 }, { at: 38, x: 480, y: 300, z: 1.45 }, { at: 78, x: 900, y: 540, z: 1 }, { at: 140, x: 900, y: 540, z: 1 }, { at: 185, x: 380, y: 300, z: 1.6 }],
    highlights: [{ x: 488, y: 34, w: 284, h: 28, delay: 4, label: "TIME SPEED" }, { x: 196, y: 36, w: 236, h: 26, delay: 158, label: "SIM CLOCK" }],
  },
  // Join a live event (local 32), land on the leaderboard
  {
    from: 1578, dur: 357, src: "event", trim: 0.45,
    keys: [{ at: 0, x: 960, y: 480, z: 1.7 }, { at: 34, x: 960, y: 480, z: 1.75 }, { at: 66, x: 960, y: 540, z: 1 }, { at: 108, x: 1790, y: 800, z: 2.0 }, { at: 214, x: 1790, y: 790, z: 2.05 }],
    vkeys: [{ at: 0, x: 1100, y: 480, z: 1.3 }, { at: 34, x: 1100, y: 480, z: 1.35 }, { at: 66, x: 900, y: 540, z: 1 }, { at: 108, x: 1790, y: 800, z: 1.8 }, { at: 214, x: 1790, y: 790, z: 1.85 }],
    highlights: [{ x: 1662, y: 580, w: 256, h: 470, delay: 116, label: "LEADERBOARD" }],
  },
];

export type CaptionSpec = { from: number; dur: number; kicker: string; title: string; accent?: string; side?: "left" | "right"; sub?: string };
export const CAPTIONS: CaptionSpec[] = [
  { from: 362, dur: 88, kicker: "Live markets", title: "Every ticker. One screen.", accent: "One screen" },
  { from: 462, dur: 72, kicker: "Charts", title: "Any range, one click.", accent: "one click" },
  { from: 548, dur: 130, kicker: "Market pulse", title: "Movers, sectors, headlines." },
  { from: 700, dur: 146, kicker: "Command bar", title: "Type a ticker. Hit enter.", accent: "Hit enter", side: "right" },
  { from: 968, dur: 122, kicker: "Simulation", title: "$100,000 to play with.", accent: "$100,000", sub: "Paper money. Zero real risk.", side: "right" },
  { from: 1112, dur: 160, kicker: "Paper trading", title: "Buy in one click.", accent: "one click" },
  { from: 1288, dur: 92, kicker: "AI news engine", title: "Trade the headlines.", accent: "headlines" },
  { from: 1395, dur: 176, kicker: "Time control", title: "Fast-forward weeks in seconds.", accent: "seconds" },
  { from: 1635, dur: 150, kicker: "Live events", title: "Compete. Climb the board.", accent: "Climb", sub: "A new challenge every five days." },
];

// Full-screen cards
export const CARDS = {
  hook: { from: 0, dur: 152 },
  logo: { from: 140, dur: 130 },
  bendTime: { from: 852, dur: 110 },
  stats: { from: 1788, dur: 150 },
  outro: { from: 1926, dur: DURATION - 1926 },
};
