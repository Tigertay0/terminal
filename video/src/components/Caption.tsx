import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F, ease } from "../theme";
import { Kicker, WordReveal } from "./Text";

// Lower-third card: mono kicker + bold title, slides out before its sequence ends
export const Caption: React.FC<{ kicker: string; title: string; accent?: string; dur: number; side?: "left" | "right"; sub?: string }> = ({ kicker, title, accent, dur, side: sideProp = "left", sub }) => {
  let side = sideProp;
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  // Portrait: full-width card under the window, always left-aligned
  if (vertical) side = "left";
  const enter = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp", easing: ease.out });
  const exit = interpolate(frame, [dur - 14, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.in });
  const dir = side === "left" ? -1 : 1;
  return (
    <div
      style={{
        position: "absolute",
        bottom: vertical ? 150 : 96,
        [side]: vertical ? 60 : 120,
        ...(vertical ? { right: 60 } : { maxWidth: 820 }),
        padding: "26px 34px 30px",
        background: "rgba(9,10,13,0.86)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderLeft: side === "left" ? `3px solid ${C.amber}` : "1px solid rgba(255,255,255,0.09)",
        borderRight: side === "right" ? `3px solid ${C.amber}` : undefined,
        borderRadius: 10,
        boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        backdropFilter: "blur(14px)",
        opacity: enter * (1 - exit),
        transform: `translateX(${dir * ((1 - enter) * 40 + exit * 60)}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        alignItems: side === "left" ? "flex-start" : "flex-end",
        textAlign: side,
      }}
    >
      <Kicker delay={2}>{kicker}</Kicker>
      <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: vertical ? 64 : 60, lineHeight: 1.05, letterSpacing: "-0.025em", color: C.text, justifyContent: side === "left" ? "flex-start" : "flex-end", display: "flex" }}>
        <WordReveal text={title} delay={6} stagger={3} wordStyle={(w) => (accent && accent.split(" ").includes(w.replace(/[.,]/g, "")) ? { color: C.amber } : undefined)} />
      </div>
      {sub && <div style={{ fontFamily: F.mono, fontSize: 22, color: C.muted, opacity: interpolate(frame, [16, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{sub}</div>}
    </div>
  );
};
