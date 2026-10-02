import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, ease } from "../theme";
import { AnimatedMark } from "../components/BrandMark";
import { Glow, Grid } from "../components/Backdrop";

const WORD = "ROCHAMBEAU";

export const LogoLockup: React.FC<{ delay?: number; markSize?: number; fontSize?: number; still?: boolean }> = ({ delay = 0, markSize = 180, fontSize = 128, still = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sub = interpolate(frame - delay, [34, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.out });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
      <AnimatedMark size={markSize} delay={delay} still={still} />
      <div style={{ display: "flex", fontFamily: F.mono, fontWeight: 700, fontSize, letterSpacing: "0.08em", color: C.amber, lineHeight: 1 }}>
        {WORD.split("").map((ch, i) => {
          const p = still ? 1 : spring({ frame: frame - delay - 14 - i * 2, fps, config: { damping: 14, stiffness: 160 } });
          return (
            <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: 6 }}>
              <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 110}%)` }}>{ch}</span>
            </span>
          );
        })}
      </div>
      <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: fontSize * 0.27, color: C.text, opacity: still ? 1 : sub, letterSpacing: `${0.2 + 0.4 * (still ? 1 : sub)}em`, marginRight: `-${0.2 + 0.4 * (still ? 1 : sub)}em` }}>
        FINANCE TERMINAL
      </div>
    </div>
  );
};

export const Logo: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const out = interpolate(frame, [dur - 22, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.in });
  return (
    <AbsoluteFill style={{ background: C.bg, opacity: fadeIn * (1 - out) }}>
      <Grid opacity={0.07} />
      <Glow opacity={0.14 + 0.06 * Math.sin(frame / 12)} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${1 + out * 0.25})`, filter: `blur(${out * 10}px)` }}>
        <LogoLockup delay={4} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
