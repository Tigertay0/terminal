import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C, ease } from "./theme";
import { Finish, Glow, Grid } from "./components/Backdrop";
import { Footage, Highlight, Window, WINDOW, type CamKey } from "./components/Footage";
import { Caption } from "./components/Caption";
import { Hook } from "./scenes/Hook";
import { Logo } from "./scenes/Logo";
import { BendTime } from "./scenes/BendTime";
import { Stats } from "./scenes/Stats";
import { Outro } from "./scenes/Outro";

// ─── Timeline (frames @ 30fps) ───────────────────────────────────
// Footage shots play inside one persistent browser window; full-screen
// cards (hook, logo, chapter break, stats, outro) cut over it. Shots run
// past the start of the card above them so its fade-in never reveals an empty window.
const WIN_START = 258;
const WIN_END = 1938;

type Shot = { from: number; dur: number; src: string; trim: number; keys: CamKey[]; rate?: number; overlay?: React.ReactNode };

const SHOTS: Shot[] = [
  // Sign-in: "Welcome to Rochambeau" picks up straight from the logo
  { from: 258, dur: 90, src: "auth", trim: 1.0, keys: [{ at: 0, x: 960, y: 390, z: 2.1 }, { at: 90, x: 960, y: 430, z: 1.6 }] },
  // Live markets: pick NVDA from the watchlist
  { from: 348, dur: 105, src: "dashboard", trim: 1.5, keys: [{ at: 0, x: 960, y: 540, z: 1 }, { at: 32, x: 500, y: 330, z: 1.75 }, { at: 105, x: 500, y: 330, z: 1.85 }] },
  // Change range, switch to MSFT
  { from: 453, dur: 84, src: "dashboard", trim: 7.2, keys: [{ at: 0, x: 1420, y: 210, z: 1.9 }, { at: 40, x: 920, y: 320, z: 1.6 }, { at: 84, x: 900, y: 320, z: 1.5 }] },
  // Losers tab, jump to TSLA, pull back to the full screen
  {
    from: 537, dur: 147, src: "dashboard", trim: 13.0,
    keys: [{ at: 0, x: 640, y: 800, z: 1.7 }, { at: 34, x: 640, y: 800, z: 1.7 }, { at: 70, x: 1150, y: 800, z: 1.7 }, { at: 96, x: 1150, y: 800, z: 1.7 }, { at: 132, x: 960, y: 540, z: 1 }],
    overlay: <Highlight x={1002} y={562} w={656} h={318} delay={64} label="SECTOR MAP" />,
  },
  // Command bar: PLTR, then AMD
  {
    from: 684, dur: 180, src: "command", trim: 3.0,
    overlay: <Highlight x={6} y={1054} w={600} h={24} delay={2} />,
    keys: [{ at: 0, x: 300, y: 1060, z: 3.0 }, { at: 40, x: 300, y: 1060, z: 3.0 }, { at: 80, x: 900, y: 420, z: 1.3 }, { at: 168, x: 900, y: 440, z: 1.25 }],
  },
  // Simulation setup (behind the chapter card at first)
  { from: 948, dur: 150, src: "setup", trim: 5.6, keys: [{ at: 0, x: 960, y: 520, z: 1.9 }, { at: 118, x: 960, y: 530, z: 1.95 }, { at: 150, x: 960, y: 540, z: 1.2 }] },
  // Buy NVDA from the trade panel
  { from: 1098, dur: 180, src: "sim", trim: 3.4, keys: [{ at: 0, x: 1500, y: 330, z: 1.25 }, { at: 22, x: 1720, y: 300, z: 2.5 }, { at: 180, x: 1720, y: 300, z: 2.6 }] },
  // AI news feed, right after the trade
  { from: 1278, dur: 105, src: "sim", trim: 9.0, keys: [{ at: 0, x: 1790, y: 800, z: 1.9 }, { at: 105, x: 1790, y: 780, z: 2.1 }] },
  // Fast-forward at 1DAY speed, end on the sim clock racing ahead
  {
    from: 1383, dur: 195, src: "sim", trim: 11.2,
    keys: [{ at: 0, x: 640, y: 60, z: 2.2 }, { at: 38, x: 640, y: 60, z: 2.2 }, { at: 78, x: 960, y: 540, z: 1 }, { at: 140, x: 960, y: 540, z: 1 }, { at: 185, x: 560, y: 160, z: 2.0 }],
    overlay: (
      <>
        <Highlight x={488} y={34} w={284} h={28} delay={4} label="TIME SPEED" />
        <Highlight x={196} y={36} w={236} h={26} delay={158} label="SIM CLOCK" />
      </>
    ),
  },
  // Join a live event, land on the leaderboard
  {
    from: 1578, dur: 360, src: "event", trim: 0.5,
    keys: [{ at: 0, x: 960, y: 480, z: 1.7 }, { at: 30, x: 960, y: 480, z: 1.75 }, { at: 62, x: 960, y: 540, z: 1 }, { at: 104, x: 1790, y: 800, z: 2.0 }, { at: 210, x: 1790, y: 790, z: 2.05 }],
    overlay: <Highlight x={1662} y={580} w={256} h={470} delay={112} label="LEADERBOARD" />,
  },
];

const CAPTIONS: { from: number; dur: number; kicker: string; title: string; accent?: string; side?: "left" | "right"; sub?: string }[] = [
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

export const DEBUT_DURATION = 2106;

const WindowLayer: React.FC = () => {
  const frame = useCurrentFrame(); // local to the window sequence
  const enter = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp", easing: ease.out });
  const back = interpolate(frame, [1788 - WIN_START, 1815 - WIN_START], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.inOut });
  return (
    <AbsoluteFill style={{ perspective: 2200, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          transform: `translateY(${(1 - enter) * 240}px) rotateX(${(1 - enter) * 26}deg) scale(${(0.84 + 0.16 * enter) * (1 - back * 0.08)})`,
          opacity: enter,
          filter: back > 0 ? `blur(${back * 10}px)` : undefined,
          transformStyle: "preserve-3d",
        }}
      >
        <Window>
          {SHOTS.map((s, i) => (
            <Sequence key={i} from={s.from - WIN_START} durationInFrames={s.dur} layout="none">
              <Footage src={s.src} trimSec={s.trim} width={WINDOW.w} height={WINDOW.h} keys={s.keys} rate={s.rate}>
                {s.overlay}
              </Footage>
            </Sequence>
          ))}
        </Window>
      </div>
    </AbsoluteFill>
  );
};

export const Debut: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Grid opacity={0.045} />
    <Glow y="100%" opacity={0.1} size={1200} />

    <Sequence from={WIN_START} durationInFrames={WIN_END - WIN_START}>
      <WindowLayer />
    </Sequence>

    {CAPTIONS.map((c, i) => (
      <Sequence key={i} from={c.from} durationInFrames={c.dur}>
        <Caption {...c} />
      </Sequence>
    ))}

    <Sequence from={0} durationInFrames={152}>
      <Hook />
    </Sequence>
    <Sequence from={140} durationInFrames={130}>
      <Logo dur={130} />
    </Sequence>
    <Sequence from={852} durationInFrames={110}>
      <BendTime dur={110} />
    </Sequence>
    <Sequence from={1788} durationInFrames={150}>
      <Stats dur={150} />
    </Sequence>
    <Sequence from={1926} durationInFrames={DEBUT_DURATION - 1926}>
      <Outro dur={DEBUT_DURATION - 1926} />
    </Sequence>

    <Finish />
  </AbsoluteFill>
);
