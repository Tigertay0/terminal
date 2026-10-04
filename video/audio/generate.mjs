// Generates the debut soundtrack from the edit timeline: an original synth track
// (A minor, ~128.6 BPM, one beat = 14 frames) and a sound-effects stem placed on
// the exact frames where things happen on screen. No samples, no licenses.
//
// Usage: node audio/generate.mjs   → public/audio/soundtrack.mp3 (+ music/sfx stems)
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SHOTS, CAPTIONS, CARDS, DURATION, FPS, WIN_START, WIN_END } from "../src/timeline.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const SR = 48000;
const LEN = Math.ceil((DURATION / FPS + 2) * SR);
const sec = (frame) => frame / FPS;

// ─── Primitives ──────────────────────────────────────────────────
let seed = 1234567;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const noise = () => rand() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class Bus {
  constructor() { this.L = new Float32Array(LEN); this.R = new Float32Array(LEN); }
  // Mixes a mono render into the bus at time t (seconds) with gain and pan (-1..1)
  add(t, mono, gain = 1, pan = 0) {
    const start = Math.round(t * SR);
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < mono.length; i++) {
      const j = start + i;
      if (j < 0 || j >= LEN) continue;
      this.L[j] += mono[i] * gl;
      this.R[j] += mono[i] * gr;
    }
  }
}

// RBJ biquad; cutoff may be a function of sample index for sweeps
function biquad(x, type, cutoff, q = 0.707) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0, b1, b2, a1, a2;
  const coeffs = (f) => {
    const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR, cw = Math.cos(w), sw = Math.sin(w), alpha = sw / (2 * q), a0 = 1 + alpha;
    if (type === "lp") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
    else if (type === "hp") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
    else { b0 = alpha; b1 = 0; b2 = -alpha; }
    a1 = -2 * cw; a2 = 1 - alpha;
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  };
  const dynamic = typeof cutoff === "function";
  if (!dynamic) coeffs(cutoff);
  for (let i = 0; i < x.length; i++) {
    if (dynamic && i % 32 === 0) coeffs(cutoff(i));
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

// Band-limited saw (polyBLEP)
function saw(freq, n, detune = 0, phase = rand()) {
  const out = new Float32Array(n);
  const inc = (freq * Math.pow(2, detune / 1200)) / SR;
  let p = phase;
  for (let i = 0; i < n; i++) {
    let v = 2 * p - 1;
    if (p < inc) { const t = p / inc; v -= t + t - t * t - 1; }
    else if (p > 1 - inc) { const t = (p - 1) / inc; v -= t * t + t + t + 1; }
    out[i] = v;
    p += inc; if (p >= 1) p -= 1;
  }
  return out;
}

function sine(freq, n, phase = 0) {
  const out = new Float32Array(n);
  const f = typeof freq === "function" ? freq : () => freq;
  let p = phase;
  for (let i = 0; i < n; i++) { out[i] = Math.sin(p); p += (2 * Math.PI * f(i)) / SR; }
  return out;
}

const white = (n) => Float32Array.from({ length: n }, noise);

// Envelope helpers (in place)
function env(x, attack, release, hold = 0) {
  const a = attack * SR, h = hold * SR, r = release * SR;
  for (let i = 0; i < x.length; i++) {
    let g;
    if (i < a) g = i / a;
    else if (i < a + h) g = 1;
    else g = Math.exp(-(i - a - h) / Math.max(1, r));
    x[i] *= g;
  }
  return x;
}
function adsr(x, a, d, s, r, noteLen) {
  const A = a * SR, D = d * SR, N = noteLen * SR, R = r * SR;
  for (let i = 0; i < x.length; i++) {
    let g;
    if (i < A) g = i / A;
    else if (i < A + D) g = 1 - (1 - s) * ((i - A) / D);
    else if (i < N) g = s;
    else g = s * Math.max(0, 1 - (i - N) / R);
    x[i] *= g;
  }
  return x;
}
const mix = (...arrs) => {
  const n = Math.max(...arrs.map((a) => a.length));
  const out = new Float32Array(n);
  for (const a of arrs) for (let i = 0; i < a.length; i++) out[i] += a[i];
  return out;
};
const delay = (x, s) => { const o = new Float32Array(x.length + Math.round(s * SR)); o.set(x, Math.round(s * SR)); return o; };
const scale = (x, g) => { for (let i = 0; i < x.length; i++) x[i] *= g; return x; };

// Freeverb-style stereo reverb on a bus
function reverb(bus, { room = 0.84, damp = 0.3, wet = 0.3 } = {}) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((n) => Math.round((n * SR) / 44100));
  const aps = [225, 556, 441, 341].map((n) => Math.round((n * SR) / 44100));
  const run = (input, spread) => {
    const out = new Float32Array(LEN);
    for (const len0 of combs) {
      const len = len0 + spread, buf = new Float32Array(len);
      let idx = 0, store = 0;
      for (let i = 0; i < LEN; i++) {
        const y = buf[idx];
        store = y * (1 - damp) + store * damp;
        buf[idx] = input[i] * 0.015 + store * room;
        out[i] += y;
        if (++idx >= len) idx = 0;
      }
    }
    for (const len0 of aps) {
      const len = len0 + spread, buf = new Float32Array(len);
      let idx = 0;
      for (let i = 0; i < LEN; i++) {
        const b = buf[idx], v = out[i];
        out[i] = -v + b;
        buf[idx] = v + b * 0.5;
        if (++idx >= len) idx = 0;
      }
    }
    return out;
  };
  const wl = run(bus.L, 0), wr = run(bus.R, 23);
  const res = new Bus();
  for (let i = 0; i < LEN; i++) { res.L[i] = bus.L[i] + wl[i] * wet; res.R[i] = bus.R[i] + wr[i] * wet; }
  return res;
}

// ─── Instruments ─────────────────────────────────────────────────
const kick = () => {
  const n = Math.round(0.42 * SR);
  const body = sine((i) => 45 + 95 * Math.exp(-i / (0.035 * SR)), n);
  env(body, 0.001, 0.16);
  const click = biquad(white(Math.round(0.006 * SR)), "hp", 3000);
  env(click, 0.0005, 0.002);
  return mix(scale(body, 1), scale(click, 0.35));
};
const clap = () => {
  const n = Math.round(0.28 * SR);
  const x = biquad(white(n), "bp", 1500, 0.9);
  // three quick bursts then a tail, like layered hands
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const burst = [0, 0.011, 0.022].reduce((g, s) => g + (t >= s ? Math.exp(-(t - s) / 0.006) : 0), 0);
    x[i] *= 0.6 * burst + Math.exp(-t / 0.07);
  }
  return scale(x, 0.9);
};
const hat = (open = false) => {
  const n = Math.round((open ? 0.22 : 0.05) * SR);
  const x = biquad(white(n), "hp", 7500, 0.8);
  return env(x, 0.0005, open ? 0.07 : 0.012);
};
const pad = (notes, dur) => {
  const n = Math.round((dur + 1.2) * SR);
  const voices = notes.flatMap((m) => [-9, 0, 9].map((d) => saw(mtof(m), n, d)));
  let x = mix(...voices);
  x = biquad(x, "lp", 1400, 0.6);
  adsr(x, 0.6, 0.4, 0.8, 1.1, dur);
  return scale(x, 0.06);
};
const bassNote = (m, dur) => {
  const n = Math.round((dur + 0.05) * SR);
  let x = mix(saw(mtof(m), n, 0, 0), scale(sine(mtof(m - 12), n), 1.2));
  x = biquad(x, "lp", (i) => 300 + 900 * Math.exp(-i / (0.06 * SR)), 1.1);
  adsr(x, 0.004, 0.08, 0.7, 0.04, dur);
  return scale(x, 0.32);
};
const pluck = (m) => {
  const n = Math.round(0.5 * SR);
  let x = mix(saw(mtof(m), n, -6), saw(mtof(m), n, 6));
  x = biquad(x, "lp", (i) => 600 + 4200 * Math.exp(-i / (0.05 * SR)), 1.4);
  env(x, 0.002, 0.14);
  return scale(x, 0.11);
};
const bell = (m, len = 1.6) => {
  const n = Math.round(len * SR);
  const f = mtof(m);
  const x = mix(sine(f, n), scale(sine(f * 2.76, n), 0.35), scale(sine(f * 5.4, n), 0.12));
  return env(x, 0.002, len / 4.5);
};

// ─── Music ───────────────────────────────────────────────────────
const BEAT = 14; // frames
const BAR = BEAT * 4;
const ORIGIN = CARDS.logo.from; // the logo hit is bar 0, beat 0
const barFrame = (b) => ORIGIN + b * BAR;
// i – VI – III – VII in A minor
const CHORDS = [
  { bass: 45, pad: [57, 60, 64], arp: [69, 72, 76, 72] },
  { bass: 41, pad: [53, 57, 60], arp: [65, 69, 72, 69] },
  { bass: 48, pad: [55, 60, 64], arp: [67, 72, 76, 72] },
  { bass: 43, pad: [55, 59, 62], arp: [67, 71, 74, 71] },
];
const chordAt = (b) => CHORDS[((Math.floor(b) % 4) + 4) % 4];

const drums = new Bus(), bass = new Bus(), pads = new Bus(), leads = new Bus();
const kickTimes = [];

const GROOVE_A = [2, 12.7]; // bars (window entrance → "bend time")
const GROOVE_B = [15, 29.4]; // bars (after the chapter card → stats)
const FAST = [sec(1383), sec(1578)]; // fast-forward shot: busier hats, higher arp
const inRange = (b, [a, z]) => b >= a && b < z;

const K = kick(), CL = clap(), HC = hat(), HO = hat(true);
for (let b = 0; b < 34; b++) {
  for (let beat = 0; beat < 4; beat++) {
    const bb = b + beat / 4;
    const f = barFrame(bb);
    if (f >= DURATION - 40) continue;
    const t = sec(f);
    const groove = inRange(bb, GROOVE_A) || inRange(bb, GROOVE_B);
    const fast = t >= FAST[0] && t < FAST[1];
    // Kick: four on the floor in grooves, downbeats only right after the logo and on the outro landing
    if (groove || ((b === 0 || b === 1 || b === 32) && beat === 0)) {
      drums.add(t, K, 0.95);
      kickTimes.push(t);
    }
    if (groove) {
      if (beat % 2 === 1) drums.add(t, CL, 0.45, 0.05);
      drums.add(t + sec(BEAT / 2), b >= 15 ? HO : HC, b >= 15 ? 0.18 : 0.22, 0.3);
      if (fast) for (const off of [0.25, 0.75]) drums.add(t + sec(BEAT * off), HC, 0.12, -0.3);
    }
  }
}
// Drum fills into the chapter card and into the stats
for (const [from, to] of [[sec(barFrame(12) + BEAT * 2), sec(852)], [sec(barFrame(28.75)), sec(1788)]]) {
  for (let t = from, k = 0; t < to; t += sec(BEAT / 4), k++) drums.add(t, CL, 0.12 + 0.3 * ((t - from) / (to - from)), k % 2 ? 0.2 : -0.2);
}
// Snare roll building out of the breakdown
for (let t = sec(952), k = 0; t < sec(980); t += sec(BEAT / 4), k++) drums.add(t, CL, 0.08 + 0.3 * ((t - sec(952)) / sec(28)), k % 2 ? 0.25 : -0.25);

// Pads: every bar from the logo to the end, plus an intro swell under the question
pads.add(sec(84), pad([57, 60, 64, 69], sec(140 - 84) + 0.2), 0.8);
for (let b = 0; b < 31.4; b++) {
  const f = barFrame(b);
  if (f >= DURATION - 60) break;
  pads.add(sec(f), pad(chordAt(b).pad, sec(BAR)), b >= 12.7 && b < 15 ? 1.15 : 0.9);
}
// Outro: one long A minor add9 that rings out under the lockup
pads.add(sec(1932), pad([57, 60, 64, 71], sec(DURATION - 1932) - 1), 1.2);

// Bass: whole notes after the logo / in the breakdown and stats, pumping 8ths in grooves
for (let b = 0; b < 32; b++) {
  const ch = chordAt(b);
  const f = barFrame(b);
  const groove = inRange(b, GROOVE_A) || inRange(b, GROOVE_B);
  if (groove) {
    for (let e = 0; e < 8; e++) {
      const fb = f + (BEAT / 2) * e;
      if ((fb - ORIGIN) / BAR >= (b < 13 ? GROOVE_A[1] : GROOVE_B[1])) break;
      if (e % 2 === 1) bass.add(sec(fb), bassNote(ch.bass + (e === 7 ? 12 : 0), sec(BEAT / 2) * 0.9), 1);
    }
  } else if (b < 2 || (b >= 13 && b < 15) || (b >= 29 && b < 32)) {
    bass.add(sec(f), bassNote(ch.bass, sec(BAR) * 0.95), 0.8);
  }
}
bass.add(sec(1932), bassNote(45, 2.5), 0.9);

// Plucked arp: second half of groove A, all of groove B (an octave up while fast-forwarding)
for (let b = 6; b < 29.4; b++) {
  if (!(inRange(b, [6, 12.7]) || inRange(b, GROOVE_B))) continue;
  const ch = chordAt(b);
  for (let s = 0; s < 16; s++) {
    const f = barFrame(b) + (BEAT / 4) * s;
    const bb = (f - ORIGIN) / BAR;
    if (!(inRange(bb, [6, 12.7]) || inRange(bb, GROOVE_B))) continue;
    const t = sec(f);
    const up = t >= FAST[0] && t < FAST[1] ? 12 : 0;
    if (s % 2 === 0 || up) leads.add(t, pluck(ch.arp[s % 4] + up), s % 4 === 0 ? 1 : 0.7, s % 2 ? 0.35 : -0.35);
  }
}

// Intro: low drone under the hook, clock ticking on the beat grid
{
  const n = Math.round(sec(150) * SR);
  let d = mix(saw(mtof(33), n, -5), saw(mtof(33), n, 5), scale(sine(mtof(21), n), 1.5));
  d = biquad(d, "lp", (i) => 200 + 500 * (i / n), 0.8);
  adsr(d, 1.5, 0.1, 1, 0.5, sec(140));
  pads.add(0, scale(d, 0.08));
}

// Sidechain: duck pads and bass under each kick so the groove breathes
function duck(bus, depth) {
  const g = new Float32Array(LEN).fill(1);
  for (const t of kickTimes) {
    const s = Math.round(t * SR);
    for (let i = 0; i < 0.3 * SR && s + i < LEN; i++) g[s + i] = Math.min(g[s + i], 1 - depth * Math.exp(-i / (0.09 * SR)));
  }
  for (let i = 0; i < LEN; i++) { bus.L[i] *= g[i]; bus.R[i] *= g[i]; }
}
duck(pads, 0.55);
duck(bass, 0.7);
duck(leads, 0.35);

// ─── Sound effects ───────────────────────────────────────────────
const sfx = new Bus();
const fx = {
  key: () => {
    const x = mix(env(biquad(white(Math.round(0.03 * SR)), "bp", 2500 + rand() * 2500, 1.2), 0.0005, 0.006), scale(env(sine(170 + rand() * 40, Math.round(0.03 * SR)), 0.001, 0.008), 0.5));
    return scale(x, 0.5);
  },
  enter: () => mix(scale(fx.key(), 1.3), scale(env(sine(120, Math.round(0.08 * SR)), 0.001, 0.025), 0.8)),
  click: () => {
    const a = env(sine(1900, Math.round(0.012 * SR)), 0.0005, 0.003);
    const b = env(biquad(white(Math.round(0.02 * SR)), "hp", 4000), 0.0005, 0.004);
    const c = scale(env(sine(600, Math.round(0.03 * SR)), 0.0008, 0.01), 0.4);
    return scale(mix(a, scale(b, 0.6), c), 0.6);
  },
  whoosh: (dur, up = true) => {
    const n = Math.round(dur * SR);
    const x = biquad(white(n), "bp", (i) => (up ? 300 + 5000 * (i / n) ** 2 : 5300 - 5000 * (i / n) ** 0.5), 1.1);
    for (let i = 0; i < n; i++) { const p = i / n; x[i] *= Math.sin(Math.PI * Math.pow(up ? p : 1 - p, up ? 0.7 : 1.3)) ** 2; }
    return scale(x, 0.9);
  },
  swish: () => scale(fx.whoosh(0.28, true), 0.5),
  impact: (size = 1) => {
    const n = Math.round(1.6 * SR);
    const sub = env(sine((i) => 32 + 60 * Math.exp(-i / (0.08 * SR)), n), 0.002, 0.35 * size);
    const crack = env(biquad(white(n), "lp", 2200, 0.7), 0.001, 0.12 * size);
    return mix(scale(sub, 1.1), scale(crack, 0.55));
  },
  riser: (dur) => {
    const n = Math.round(dur * SR);
    const nz = biquad(white(n), "bp", (i) => 400 + 7000 * (i / n) ** 2, 2);
    const tone = sine((i) => 220 + 660 * (i / n) ** 2, n);
    const x = mix(nz, scale(tone, 0.15));
    for (let i = 0; i < n; i++) x[i] *= (i / n) ** 2;
    return scale(x, 0.7);
  },
  downlifter: (dur) => {
    const n = Math.round(dur * SR);
    const x = mix(biquad(white(n), "bp", (i) => 6000 * (1 - i / n) + 200, 1.5), scale(sine((i) => 700 * (1 - i / n) + 60, n), 0.2));
    for (let i = 0; i < n; i++) x[i] *= (1 - i / n) ** 1.5;
    return scale(x, 0.6);
  },
  blip: (m) => scale(env(mix(sine(mtof(m), Math.round(0.12 * SR)), scale(sine(mtof(m + 12), Math.round(0.12 * SR)), 0.3)), 0.002, 0.04), 0.45),
  draw: () => {
    // a soft rising "scan" for the highlight outlines
    const n = Math.round(0.5 * SR);
    const x = mix(biquad(white(n), "bp", (i) => 1200 + 3000 * (i / n), 4), scale(sine((i) => 880 + 440 * (i / n), n), 0.12));
    for (let i = 0; i < n; i++) x[i] *= Math.sin((Math.PI * i) / n) ** 2;
    return scale(x, 0.4);
  },
  scratch: () => {
    const n = Math.round(0.35 * SR);
    const x = biquad(white(n), "bp", (i) => 800 + 5000 * (i / n), 3);
    for (let i = 0; i < n; i++) x[i] *= Math.sin((Math.PI * i) / n);
    return scale(x, 0.8);
  },
  fall: () => {
    // the red loss line: a slow descending tone
    const n = Math.round(2.2 * SR);
    const x = mix(sine((i) => 330 * Math.pow(0.35, i / n), n), scale(saw(110, n), 0.05));
    for (let i = 0; i < n; i++) x[i] *= Math.min(1, i / (0.2 * SR)) * (1 - i / n);
    return scale(biquad(x, "lp", 1800), 0.25);
  },
  chime: () => mix(bell(76, 1.4), delay(bell(81, 1.6), 0.11)),
  thud: () => scale(mix(env(sine((i) => 70 + 80 * Math.exp(-i / (0.02 * SR)), Math.round(0.3 * SR)), 0.001, 0.07), scale(env(biquad(white(Math.round(0.05 * SR)), "lp", 1500), 0.001, 0.01), 0.4)), 0.9),
};

const put = (frame, sound, gain = 1, pan = 0) => sfx.add(sec(frame), sound, gain, pan);

// Hook
[0, 1, 2, 3, 4].forEach((i) => put(4 + 3 * i, fx.key(), 0.35, -0.2 + i * 0.1));
[0, 1, 2, 3].forEach((i) => put(18 + 4 * i, fx.key(), 0.35, -0.15 + i * 0.1));
put(6, fx.fall(), 0.9);
put(48, fx.scratch(), 0.8, 0.2);
put(72, fx.whoosh(0.5, false), 0.6);
put(96, bell(88, 2.2), 0.18, 0.3);
put(100, fx.riser(sec(144 - 100)), 0.55);

// Logo: boom, then each shape lands
put(144, fx.impact(1.2), 1);
put(150, fx.thud(), 0.6, 0);
put(156, fx.swish(), 0.5, -0.5);
put(162, fx.swish(), 0.45, 0.5);
put(172, bell(81, 1.8), 0.22, 0.2);
put(CARDS.logo.from + CARDS.logo.dur - 26, fx.whoosh(0.7, true), 0.6);

// Window entrance
put(WIN_START, fx.whoosh(0.9, true), 0.55);
put(WIN_START + 28, fx.thud(), 0.45);

// Captions and highlights
for (const c of CAPTIONS) put(c.from + 1, fx.swish(), 0.35, -0.3);
for (const s of SHOTS) for (const h of s.highlights ?? []) {
  const f = s.from + h.delay;
  if (f < WIN_END && f < CARDS.stats.from) put(f, fx.draw(), 0.7, 0.2);
}

// Input events from the capture logs, mapped through each shot's trim
const special = { "sim:3": "success", "sim:5": "speed", "setup:4": "start", "event:0": "success" };
for (const s of SHOTS) {
  if (s.quiet) continue;
  const events = JSON.parse(fs.readFileSync(path.join(root, "public", "footage", `${s.src}.events.json`), "utf8"));
  let clickIndex = -1;
  for (const e of events) {
    if (e.type === "click") clickIndex++;
    const local = (e.t - s.trim) * FPS;
    if (local < 0 || local >= s.dur) continue;
    const f = s.from + local;
    if (f >= CARDS.stats.from || (f >= CARDS.bendTime.from && f < CARDS.bendTime.from + CARDS.bendTime.dur)) continue;
    if (e.type === "key") put(f, fx.key(), 1, 0.1);
    else if (e.type === "enter") put(f, fx.enter(), 1, 0.1);
    else {
      put(f, fx.click(), 0.8, 0.15);
      const kind = special[`${s.src}:${clickIndex}`];
      if (kind === "success") put(f + 4, fx.chime(), 0.3, 0.2);
      if (kind === "speed") put(f + 2, fx.riser(0.8), 0.4);
      if (kind === "start") put(f + 2, fx.whoosh(0.6, true), 0.5);
    }
  }
}

// Chapter card: rewind-stop, speed chips stepping up, accelerating clock
{
  const t0 = CARDS.bendTime.from;
  put(t0 - 10, fx.downlifter(0.5), 0.6);
  put(t0, fx.impact(0.7), 0.7);
  const steps = [22, 32, 41, 51, 61];
  steps.forEach((d, i) => put(t0 + d, fx.blip(76 + i * 2), 0.8, -0.4 + i * 0.2));
  // ticks follow the DAY counter's ease-in acceleration
  for (let f = t0 + 30, gap = 9; f < t0 + CARDS.bendTime.dur - 8; f += gap, gap = Math.max(1.5, gap * 0.86)) put(f, fx.key(), 0.35, ((f * 7) % 5) / 5 - 0.4);
  put(930, fx.riser(sec(980 - 930)), 0.5);
}

// Stats: three hits on the beat, with a count-up rattle
{
  const t0 = CARDS.stats.from;
  put(t0 - 4, fx.whoosh(0.4, false), 0.5);
  [0, 1, 2].forEach((i) => {
    put(t0 + 8 + i * 14, fx.impact(0.55), 0.55);
    put(t0 + 8 + i * 14, bell(69 + [0, 3, 7][i], 1.2), 0.2);
    for (let k = 0; k < 8; k++) put(t0 + 8 + i * 14 + k * 2.2, fx.key(), 0.25, i * 0.4 - 0.4);
  });
  put(1880, fx.riser(sec(1932 - 1880)), 0.55);
}

// Outro: the big landing, tagline shimmer, pills
put(1932, fx.impact(1.4), 1);
put(1934, bell(81, 3), 0.25, 0);
put(1972, bell(88, 2.5), 0.16, 0.3);
[0, 1, 2].forEach((i) => put(1996 + i * 3, fx.blip(84 + i * 3), 0.35, -0.4 + i * 0.4));

// ─── Mixdown ─────────────────────────────────────────────────────
function sum(...buses) {
  const out = new Bus();
  for (const [b, g] of buses) for (let i = 0; i < LEN; i++) { out.L[i] += b.L[i] * g; out.R[i] += b.R[i] * g; }
  return out;
}
function master(bus, peak) {
  // fade out with the picture, gentle tanh limiter, normalise to the target peak
  const end = Math.round(sec(DURATION) * SR), fade = Math.round(sec(46) * SR);
  let m = 0;
  for (let i = 0; i < LEN; i++) {
    const g = i > end ? 0 : i > end - fade ? (end - i) / fade : 1;
    bus.L[i] = Math.tanh(bus.L[i] * 1.2 * g);
    bus.R[i] = Math.tanh(bus.R[i] * 1.2 * g);
    m = Math.max(m, Math.abs(bus.L[i]), Math.abs(bus.R[i]));
  }
  const k = peak / (m || 1);
  for (let i = 0; i < LEN; i++) { bus.L[i] *= k; bus.R[i] *= k; }
  return bus;
}
function writeMp3(bus, file) {
  const n = Math.round(sec(DURATION) * SR);
  const pcm = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(bus.L[i] * 32767))), i * 4);
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(bus.R[i] * 32767))), i * 4 + 2);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "s16le", "-ar", String(SR), "-ac", "2", "-i", "-", "-c:a", "libmp3lame", "-b:a", "256k", file], { input: pcm });
  if (r.status !== 0) throw new Error(String(r.stderr));
  console.log("wrote", path.relative(root, file));
}

const music = master(reverb(sum([drums, 0.9], [bass, 1], [reverb(pads, { wet: 0.5 }), 1], [leads, 1]), { wet: 0.12, room: 0.7 }), 0.89);
const effects = master(reverb(sfx, { wet: 0.22, room: 0.8 }), 0.89);
writeMp3(music, path.join(root, "public", "audio", "music.mp3"));
writeMp3(effects, path.join(root, "public", "audio", "sfx.mp3"));
// The composition plays this limited master; the stems above are for re-balancing
writeMp3(master(sum([music, 0.6], [effects, 0.85]), 0.89), path.join(root, "public", "audio", "soundtrack.mp3"));
