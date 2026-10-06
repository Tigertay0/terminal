import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F, ease } from "../theme";
import { Glow, Grid } from "../components/Backdrop";
import { LogoLockup } from "./Logo";
import { WordReveal } from "../components/Text";

export const Outro: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const black = interpolate(frame, [dur - 24, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.in });
  const rise = interpolate(frame, [40, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.out });
  const pills = interpolate(frame, [70, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.out });
  return (
    <AbsoluteFill style={{ background: C.bg, opacity: fadeIn }}>
      <Grid opacity={0.06} />
      <Glow opacity={0.16} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", transform: `translateY(${-rise * 40}px)` }}>
        <LogoLockup delay={2} markSize={150} fontSize={112} />
        <div style={{ marginTop: 64, fontFamily: F.serif, fontStyle: "italic", fontWeight: 300, fontSize: 64, color: C.text, display: "flex" }}>
          <WordReveal text="Play the market. Risk nothing." delay={46} stagger={4} duration={20} wordStyle={(_, i) => (i >= 3 ? { color: C.amber } : undefined)} />
        </div>
        <div style={{ marginTop: 44, display: "flex", gap: 16, opacity: pills, transform: `translateY(${(1 - pills) * 16}px)` }}>
          {["LIVE MARKETS", "SIMULATION", "EVENTS"].map((t) => (
            <span key={t} style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: "0.2em", color: C.muted, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 999, padding: "10px 22px" }}>{t}</span>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#000", opacity: black }} />
    </AbsoluteFill>
  );
};
