import { OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, F, ease } from "../theme";

export const SRC_W = 1920;
export const SRC_H = 1080;

import type { CamKey } from "../timeline";

function camAt(keys: CamKey[], frame: number) {
  if (frame <= keys[0].at) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (frame <= b.at) {
      const t = interpolate(frame, [a.at, b.at], [0, 1], { easing: ease.inOut });
      return { at: frame, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    }
  }
  return keys[keys.length - 1];
}

// A screen recording inside a viewport, driven by a virtual camera.
// Overlay children are positioned in source pixels and move with the camera.
// fit "width": z = 1 shows the full capture width (landscape window).
// fit "cover": z = 1 fills the viewport height (portrait window crops to the action).
export const Footage: React.FC<{
  src: string;
  trimSec: number;
  width: number;
  height: number;
  keys?: CamKey[];
  rate?: number;
  fit?: "width" | "cover";
  children?: React.ReactNode;
}> = ({ src, trimSec, width, height, keys = [{ at: 0, x: SRC_W / 2, y: SRC_H / 2, z: 1 }], rate = 1, fit = "width", children }) => {
  const frame = useCurrentFrame();
  const cam = camAt(keys, frame);
  const k = (fit === "cover" ? height / SRC_H : width / SRC_W) * cam.z;
  const tx = Math.min(0, Math.max(width - SRC_W * k, width / 2 - cam.x * k));
  const ty = Math.min(0, Math.max(height - SRC_H * k, height / 2 - cam.y * k));
  return (
    <div style={{ position: "absolute", inset: 0, width, height, overflow: "hidden", background: C.bg }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: SRC_W, height: SRC_H, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${k})` }}>
        <OffthreadVideo src={staticFile(`footage/${src}.mp4`)} trimBefore={Math.round(trimSec * 30)} playbackRate={rate} muted style={{ width: SRC_W, height: SRC_H, display: "block" }} />
        {children}
      </div>
    </div>
  );
};

// Amber outline that draws itself around a UI region (source pixel coords)
export const Highlight: React.FC<{ x: number; y: number; w: number; h: number; delay?: number; label?: string }> = ({ x, y, w, h, delay = 0, label }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease.out });
  const per = 2 * (w + h);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, pointerEvents: "none" }}>
      <svg width={w} height={h} style={{ position: "absolute", overflow: "visible" }}>
        <rect x={-3} y={-3} width={w + 6} height={h + 6} rx={6} fill="hsla(36,100%,50%,0.06)" stroke={C.amber} strokeWidth={2.5} strokeDasharray={per + 24} strokeDashoffset={(per + 24) * (1 - p)} opacity={p > 0 ? 1 : 0} />
      </svg>
      {label && (
        <div style={{ position: "absolute", left: -3, top: -30, fontFamily: F.mono, fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", color: "#000", background: C.amber, padding: "3px 8px", borderRadius: 3, opacity: p, transform: `translateY(${(1 - p) * 8}px)` }}>
          {label}
        </div>
      )}
    </div>
  );
};

// Browser window chrome around the footage
export const WINDOW = { w: 1600, h: 900, bar: 40 };
export const VWINDOW = { w: 1000, h: 1300, bar: 40 };
export const Window: React.FC<{ w: number; h: number; children: React.ReactNode }> = ({ w, h, children }) => (
  <div
    style={{
      width: w,
      height: h + WINDOW.bar,
      borderRadius: 14,
      overflow: "hidden",
      background: C.panel,
      border: `1px solid rgba(255,255,255,0.10)`,
      boxShadow: "0 40px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,0,0,0.6), 0 0 80px hsla(36,100%,50%,0.10)",
    }}
  >
    <div style={{ height: WINDOW.bar, display: "flex", alignItems: "center", padding: "0 16px", gap: 8, background: "#15171c", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.85 }} />
      ))}
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: F.mono, fontSize: 14, color: C.muted, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24">
          <circle cx="12" cy="6" r="4" fill={C.amber} />
          <rect x="2" y="14" width="8" height="8" rx="1" fill={C.amber} opacity="0.7" />
          <path d="M18 14 L22.5 22 L13.5 22 Z" fill={C.amber} opacity="0.45" />
        </svg>
        Rochambeau Finance Terminal
      </div>
    </div>
    <div style={{ position: "relative", width: w, height: h }}>{children}</div>
  </div>
);
