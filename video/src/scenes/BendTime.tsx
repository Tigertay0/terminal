import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, ease } from "../theme";
import { Glow, Grid } from "../components/Backdrop";
import { WordReveal } from "../components/Text";

// Same labels as the app's TimeControlBar
const SPEEDS = ["PAUSE", "1x", "5x", "1HR", "1DAY"];

export const BendTime: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const v = height > width;
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const out = interpolate(frame, [dur - 12, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.in });
  const active = Math.min(SPEEDS.length - 1, Math.floor(interpolate(frame, [22, 70], [0, SPEEDS.length - 0.01], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  // Day counter accelerates as the speed climbs
  const dayP = interpolate(frame, [30, dur - 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.in });
  const day = Math.max(1, Math.round(1 + dayP * 99));
  const scroll = Math.pow(Math.max(0, frame - 20), 1.8) * 0.9;

  let d = "";
  for (let i = 0; i <= 120; i++) {
    const x = i * 18;
    const t = (x + scroll) / 70;
    const y = 120 - Math.sin(t) * 30 - Math.sin(t * 2.7) * 14 - (x + scroll) * 0.04 % 60;
    d += `${i === 0 ? "M" : "L"}${x},${y.toFixed(1)}`;
  }

  return (
    <AbsoluteFill style={{ background: C.bg, opacity: fadeIn * (1 - out) }}>
      <Grid opacity={0.05} />
      <Glow y="70%" opacity={0.12} />
      <svg viewBox="0 0 2160 240" style={{ position: "absolute", left: -120, bottom: 70, width: 2160, opacity: 0.35 }}>
        <path d={d} fill="none" stroke={C.green} strokeWidth={3} />
      </svg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 48, transform: `scale(${1 + out * 0.08})` }}>
        <div style={{ fontFamily: F.serif, fontStyle: "italic", fontWeight: 300, fontSize: v ? 124 : 150, color: C.text, letterSpacing: "-0.02em", display: "flex", lineHeight: 1 }}>
          <WordReveal text="Then, bend time." delay={2} stagger={5} duration={20} wordStyle={(_, i) => (i >= 1 ? { color: C.amber } : undefined)} />
        </div>
        <div style={{ display: "flex", gap: 14, opacity: interpolate(frame, [14, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          {SPEEDS.map((s, i) => (
            <div
              key={s}
              style={{
                fontFamily: F.mono,
                fontWeight: 700,
                fontSize: v ? 28 : 32,
                letterSpacing: "0.08em",
                padding: v ? "12px 20px" : "12px 26px",
                borderRadius: 6,
                border: `1.5px solid ${i === active ? C.amber : "rgba(255,255,255,0.12)"}`,
                color: i === active ? C.amber : C.muted,
                background: i === active ? C.amberSoft : "transparent",
                transform: `scale(${i === active ? 1.08 : 1})`,
              }}
            >
              {s}
            </div>
          ))}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 40, color: C.text, letterSpacing: "0.1em", opacity: interpolate(frame, [26, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          DAY <span style={{ color: C.amber, fontWeight: 700 }}>{String(day).padStart(3, "0")}</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
