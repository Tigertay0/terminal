import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";

// Faint amber grid, same motif as the app's sign-in screen, drifting slowly
export const Grid: React.FC<{ opacity?: number; size?: number }> = ({ opacity = 0.06, size = 64 }) => {
  const frame = useCurrentFrame();
  const shift = (frame * 0.25) % size;
  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundImage: `linear-gradient(to right, ${C.amber} 1px, transparent 1px), linear-gradient(to bottom, ${C.amber} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${shift}px ${shift}px`,
        maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
      }}
    />
  );
};

export const Glow: React.FC<{ x?: string; y?: string; color?: string; size?: number; opacity?: number }> = ({ x = "50%", y = "50%", color = C.amber, size = 900, opacity = 0.16 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(${size}px circle at ${x} ${y}, ${color}, transparent 70%)`, opacity }} />
);

// Film grain + vignette, layered over everything for a finished look
export const Finish: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.07, mixBlendMode: "overlay" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 12} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};
