import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F, ease } from "../theme";
import { WordReveal } from "../components/Text";

// A losing trade drawn behind the opening line
const LOSS = "M0,120 L60,100 L120,130 L180,90 L240,110 L300,70 L360,95 L420,60 L480,140 L540,190 L600,170 L660,240 L720,220 L780,300 L840,280 L900,360 L960,340 L1020,420 L1080,400 L1140,470";

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [6, 70], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.inOut });
  const strike = interpolate(frame, [48, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.out });
  const outA = interpolate(frame, [74, 88], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.in });
  const chartFade = interpolate(frame, [70, 88], [0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 1140 480" width={1800} height={758} style={{ position: "absolute", left: 60, top: 560, opacity: chartFade * 0.8 }}>
        <path d={LOSS} fill="none" stroke={C.red} strokeWidth={4} strokeDasharray={2200} strokeDashoffset={2200 * draw} strokeLinejoin="round" />
      </svg>

      <div style={{ textAlign: "center", opacity: 1 - outA, transform: `translateY(${-outA * 40}px)`, filter: `blur(${outA * 8}px)` }}>
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 96, letterSpacing: "-0.035em", color: C.text, display: "flex", justifyContent: "center" }}>
          <WordReveal text="Most people learn the market" delay={4} stagger={3} />
        </div>
        <div style={{ position: "relative", display: "inline-block", marginTop: 10, fontFamily: F.sans, fontWeight: 700, fontSize: 96, letterSpacing: "-0.035em", color: C.text }}>
          <WordReveal text="by losing real money." delay={18} stagger={4} wordStyle={(_, i) => (i >= 2 ? { color: C.red } : undefined)} />
          <span style={{ position: "absolute", left: "-2%", top: "54%", height: 8, width: `${104 * strike}%`, background: C.amber, borderRadius: 4 }} />
        </div>
      </div>

      <div style={{ position: "absolute", textAlign: "center", fontFamily: F.serif, fontStyle: "italic", fontWeight: 300, fontSize: 104, color: C.text, letterSpacing: "-0.02em", display: "flex", justifyContent: "center" }}>
        <WordReveal text="What if practice felt real?" delay={84} stagger={4} duration={20} wordStyle={(_, i) => (i >= 3 ? { color: C.amber } : undefined)} />
      </div>
    </AbsoluteFill>
  );
};
