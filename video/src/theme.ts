import { Easing } from "remotion";

// Pulled from the app's own tokens (src/index.css) so the film matches the product
export const C = {
  bg: "#0a0b0e",
  panel: "#111318",
  line: "rgba(255,255,255,0.08)",
  text: "#e8e6e1",
  muted: "#8b8f98",
  amber: "hsl(36, 100%, 50%)",
  amberSoft: "hsla(36, 100%, 50%, 0.18)",
  green: "hsl(142, 70%, 45%)",
  red: "hsl(0, 72%, 55%)",
  cyan: "hsl(174, 72%, 56%)",
};

export const F = {
  mono: "'JetBrains Mono', ui-monospace, monospace",
  sans: "Inter, system-ui, sans-serif",
  serif: "'IBM Plex Serif', Georgia, serif",
};

// One easing family for the whole film: fast out, long settle
export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
};
