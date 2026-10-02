import { interpolate, useCurrentFrame } from "remotion";
import { C, F, ease } from "../theme";

// Words rise out of a mask one after another
export const WordReveal: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  style?: React.CSSProperties;
  wordStyle?: (word: string, i: number) => React.CSSProperties | undefined;
}> = ({ text, delay = 0, stagger = 3, duration = 18, style, wordStyle }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", justifyContent: "inherit", columnGap: "0.28em", ...style }}>
      {words.map((w, i) => {
        const p = interpolate(frame - delay - i * stagger, [0, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.out });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.08em", marginBottom: "-0.08em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 105}%)`, ...wordStyle?.(w, i) }}>{w}</span>
          </span>
        );
      })}
    </span>
  );
};

// Terminal-style typing with a block cursor
export const Typed: React.FC<{ text: string; delay?: number; cps?: number; style?: React.CSSProperties; cursor?: boolean }> = ({ text, delay = 0, cps = 22, style, cursor = true }) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor(((frame - delay) / 30) * cps)));
  const blink = Math.floor(frame / 15) % 2 === 0;
  return (
    <span style={style}>
      {text.slice(0, n)}
      {cursor && <span style={{ display: "inline-block", width: "0.55em", height: "1em", marginLeft: "0.08em", verticalAlign: "-0.12em", background: C.amber, opacity: n < text.length || blink ? 1 : 0 }} />}
    </span>
  );
};

// Small mono label used above titles
export const Kicker: React.FC<{ children: React.ReactNode; color?: string; delay?: number }> = ({ children, color = C.amber, delay = 0 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.out });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: F.mono, fontSize: 22, letterSpacing: "0.22em", color, textTransform: "uppercase", opacity: p }}>
      <span style={{ width: 44 * p, height: 2, background: color, display: "inline-block" }} />
      {children}
    </div>
  );
};
