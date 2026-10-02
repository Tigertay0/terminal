import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F, ease } from "../theme";

// Every figure here is read from the app: INDEX_SYMBOLS (9), the four
// TimeControlBar speeds, and paper money only.
const STATS = [
  { value: 9, prefix: "", label: "global indices, live" },
  { value: 4, prefix: "", label: "speeds to bend time" },
  { value: 0, prefix: "$", label: "real money at risk" },
];

export const Stats: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const out = interpolate(frame, [dur - 14, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.in });
  return (
    <AbsoluteFill style={{ background: "rgba(8,9,12,0.72)", opacity: fadeIn * (1 - out), alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", gap: 0 }}>
        {STATS.map((s, i) => {
          const p = interpolate(frame - 8 - i * 14, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.out });
          const count = s.value === 0 ? Math.round((1 - p) * 250) : Math.round(p * s.value);
          return (
            <div key={i} style={{ width: 520, padding: "0 40px", borderLeft: i ? "1px solid rgba(255,255,255,0.12)" : "none", opacity: p, transform: `translateY(${(1 - p) * 50}px)`, textAlign: "center" }}>
              <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 210, color: i === 2 ? C.amber : C.text, lineHeight: 1, letterSpacing: "-0.04em" }}>
                {s.prefix}{count}
              </div>
              <div style={{ marginTop: 22, fontFamily: F.mono, fontSize: 28, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
