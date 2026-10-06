import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

// The app's mark (src/components/BrandMark.tsx): rock, paper, scissors.
// Each shape arrives on its own spring so the logo "plays" itself.
export const AnimatedMark: React.FC<{ size: number; delay?: number; still?: boolean }> = ({ size, delay = 0, still = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (d: number, cfg = { damping: 12, stiffness: 120, mass: 0.8 }) =>
    still ? 1 : spring({ frame: frame - delay - d, fps, config: cfg });
  const rock = s(0);
  const paper = s(6);
  const scissors = s(12, { damping: 10, stiffness: 140, mass: 0.7 });
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ overflow: "visible" }}>
      <circle cx="12" cy={interpolate(rock, [0, 1], [-10, 6])} r={4 * Math.min(1, rock * 1.2)} fill={C.amber} />
      <rect x={interpolate(paper, [0, 1], [-14, 2])} y="14" width="8" height="8" rx="1" fill={C.amber} opacity={0.7 * Math.min(1, paper * 1.5)} />
      <path
        d="M18 14 L22.5 22 L13.5 22 Z"
        fill={C.amber}
        opacity={0.45 * Math.min(1, scissors * 1.5)}
        transform={`rotate(${interpolate(scissors, [0, 1], [-200, 0])} 18 19) translate(${interpolate(scissors, [0, 1], [14, 0])} 0)`}
      />
    </svg>
  );
};
