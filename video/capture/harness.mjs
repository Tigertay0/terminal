// Shared Playwright setup: mocked network, local fonts, CDP screencast recorder.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import * as mock from "./mock-data.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fontsRoot = path.join(here, "..", "node_modules", "@fontsource");

function fontCss() {
  const pick = { inter: ["400", "500", "600", "700"], "jetbrains-mono": ["400", "500", "600", "700"], "ibm-plex-serif": ["300", "400", "500", "300-italic", "400-italic"] };
  let css = "";
  for (const [fam, weights] of Object.entries(pick)) {
    for (const w of weights) {
      css += fs.readFileSync(path.join(fontsRoot, fam, `${w}.css`), "utf8").replaceAll("./files/", `https://fonts.local/${fam}/files/`);
    }
  }
  return css;
}

async function installRoutes(context, { authed }) {
  const css = fontCss();
  await context.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "text/css", body: css }));
  await context.route("https://fonts.local/**", (r) => {
    const rel = new URL(r.request().url()).pathname.slice(1);
    r.fulfill({ status: 200, contentType: "font/woff2", body: fs.readFileSync(path.join(fontsRoot, rel)) });
  });

  // The app's own API (auth, saved data, events). Registered first, so the more
  // specific routes below win; market data falls through to them.
  await context.route("**/api/**", (r) => {
    const req = r.request();
    const { pathname } = new URL(req.url());
    const method = req.method();
    if (pathname.startsWith("/api/yf/")) return r.fallback();
    if (pathname === "/api/auth/get-session") return r.fulfill({ json: authed ? mock.session() : null });
    if (pathname.startsWith("/api/auth/")) return r.fulfill({ json: {} });
    if (pathname === "/api/config") return r.fulfill({ json: { google: true } });
    if (pathname === "/api/watchlist") return method === "GET" ? r.fulfill({ json: { symbols: mock.WATCHLIST } }) : r.fulfill({ status: 204, body: "" });
    if (pathname === "/api/saves") return method === "GET" ? r.fulfill({ json: globalThis.__captureSaves ?? [] }) : r.fulfill({ status: 201, json: { id: "save-new" } });
    if (pathname.startsWith("/api/saves/")) return method === "DELETE" ? r.fulfill({ status: 204, body: "" }) : r.fulfill({ json: { id: pathname.split("/").pop() } });
    if (pathname === "/api/events/completed") return r.fulfill({ json: [] });
    if (pathname.startsWith("/api/events/entries/")) return r.fulfill({ status: 204, body: "" });
    const event = pathname.match(/^\/api\/events\/([^/]+)\/(entry|leaderboard)$/);
    if (event) {
      const key = decodeURIComponent(event[1]);
      if (event[2] === "leaderboard") return r.fulfill({ json: mock.leaderboard(key) });
      if (method === "GET") return r.fulfill({ json: null });
      return r.fulfill({ status: 201, json: { id: "p1", event_key: key, user_id: mock.USER.id, display_name: "Demo", current_day: 1, profit: 0, portfolio: null, settings: null, status: "active", final_stats: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } });
    }
    return r.fulfill({ status: 404, json: { error: "Not found" } });
  });

  await context.route("**/api/yf/quote**", (r) => {
    const syms = new URL(r.request().url()).searchParams.get("symbols").split(",");
    r.fulfill({ json: syms.map(mock.quote).filter(Boolean) });
  });
  await context.route("**/api/yf/chart**", (r) => {
    const u = new URL(r.request().url()).searchParams;
    r.fulfill({ json: mock.chart(u.get("symbol"), u.get("range") ?? "6mo") });
  });
  await context.route("**/api/yf/search**", (r) => r.fulfill({ json: mock.search(new URL(r.request().url()).searchParams.get("q") ?? "") }));
  await context.route("**/api/ai-news**", (r) => {
    const body = JSON.parse(r.request().postData() || "{}");
    if (body.mode === "detailed") return r.fulfill({ json: [] });
    r.fulfill({ json: mock.aiNews() });
  });
}

export async function startDevServer(port = 5173) {
  const root = path.join(here, "..", "..");
  const proc = spawn("npx", ["vite", "--port", String(port), "--strictPort"], { cwd: root, stdio: "ignore", detached: false });
  // Poll until the dev server answers
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${port}/`); if (r.ok) return proc; } catch {}
    await sleep(500);
  }
  proc.kill();
  throw new Error("vite did not start");
}

export async function openApp({ width = 1920, height = 1080, scale = 1, authed = true, url = "http://localhost:5173/" } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium", args: ["--disable-gpu", "--font-render-hinting=none"] });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: "dark" });
  await installRoutes(context, { authed });
  await context.addInitScript(() => {
    // Theme preference; dark is the product's signature look
    localStorage.setItem("rochambeau-theme", "dark");
  });
  await context.addInitScript(() => {
    // Screencasts don't include the OS cursor, so draw one that tracks the mouse
    const install = () => {
      if (document.getElementById("__cursor")) return;
      const c = document.createElement("div");
      c.id = "__cursor";
      c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 14.8 L11.6 21.6 L14.6 20.3 L11.5 13.6 L17.6 13.4 Z" fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/></svg>';
      Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none", transform: "translate(-100px,-100px)", transition: "none", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.5))" });
      const ring = document.createElement("div");
      Object.assign(ring.style, { position: "fixed", width: "34px", height: "34px", marginLeft: "-17px", marginTop: "-17px", borderRadius: "50%", border: "2px solid hsl(36,100%,55%)", zIndex: "2147483646", pointerEvents: "none", opacity: "0", transform: "scale(.4)", transition: "opacity .35s ease, transform .35s ease" });
      document.body.append(c, ring);
      addEventListener("mousemove", (e) => { c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`; }, true);
      addEventListener("mousedown", (e) => {
        ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px";
        ring.style.transition = "none"; ring.style.opacity = "1"; ring.style.transform = "scale(.4)";
        requestAnimationFrame(() => { ring.style.transition = "opacity .45s ease, transform .45s ease"; ring.style.opacity = "0"; ring.style.transform = "scale(1.4)"; });
      }, true);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error("[pageerror]", e.message));
  await page.goto(url);
  return { browser, context, page };
}

// Records the page via CDP screencast into a constant-30fps MP4.
// Screencast frames come out at CSS-pixel size, so capture at a 1:1 1920x1080 viewport.
export async function startRecording(page, outFile, { maxWidth = 1920, maxHeight = 1080 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const frameDir = fs.mkdtempSync(path.join(path.dirname(outFile), ".frames-"));
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = path.join(frameDir, `${String(frames.length).padStart(6, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth, maxHeight, everyNthFrame: 1 });
  const started = Date.now() / 1000;

  page.__events = [];
  return async function stop() {
    await cdp.send("Page.stopScreencast");
    const ended = Date.now() / 1000;
    if (frames.length === 0) throw new Error("no frames captured");
    // ffmpeg concat list with per-frame durations (screencast is variable-rate)
    let list = "";
    for (let i = 0; i < frames.length; i++) {
      const next = i + 1 < frames.length ? frames[i + 1].t : ended;
      const dur = Math.max(1 / 60, next - frames[i].t);
      list += `file '${frames[i].file}'\nduration ${dur.toFixed(4)}\n`;
    }
    list += `file '${frames[frames.length - 1].file}'\n`;
    const listFile = path.join(frameDir, "list.txt");
    fs.writeFileSync(listFile, list);
    await new Promise((res, rej) => {
      const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile,
        "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-movflags", "+faststart", outFile], { stdio: "inherit" });
      ff.on("exit", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`))));
    });
    fs.rmSync(frameDir, { recursive: true, force: true });
    // Sidecar with input events in video time, used to sync sound effects
    const t0 = frames[0].t;
    const events = page.__events.map((e) => ({ type: e.type, t: +(e.epoch - t0).toFixed(3) })).filter((e) => e.t >= 0);
    fs.writeFileSync(outFile.replace(/\.mp4$/, ".events.json"), JSON.stringify(events, null, 1) + "\n");
    page.__events = null;
    const fps = frames.length / (ended - started);
    console.log(`  ${path.basename(outFile)}: ${frames.length} frames, ${(ended - started).toFixed(1)}s, ~${fps.toFixed(1)} fps captured`);
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Human-paced pointer helpers
export async function glide(page, selectorOrPoint, { steps = 28, pause = 120 } = {}) {
  let x, y;
  if (typeof selectorOrPoint === "string") {
    const box = await page.locator(selectorOrPoint).first().boundingBox();
    if (!box) throw new Error(`no box for ${selectorOrPoint}`);
    x = box.x + box.width / 2; y = box.y + box.height / 2;
  } else ({ x, y } = selectorOrPoint);
  await page.mouse.move(x, y, { steps });
  await sleep(pause);
  return { x, y };
}
const log = (page, type) => page.__events?.push({ type, epoch: Date.now() / 1000 });
export async function tap(page, selectorOrPoint, opts) {
  await glide(page, selectorOrPoint, opts);
  log(page, "click");
  await page.mouse.down(); await sleep(70); await page.mouse.up();
}
export async function typeSlow(page, text, delay = 110) {
  for (const ch of text) { log(page, "key"); await page.keyboard.type(ch); await sleep(delay); }
}
export async function press(page, key) {
  log(page, key === "Enter" ? "enter" : "key");
  await page.keyboard.press(key);
}
