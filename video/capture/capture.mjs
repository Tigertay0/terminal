// Records product footage of the real app into public/footage/*.mp4.
// Usage: npm run capture [-- clipName ...]
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { startDevServer, openApp, startRecording, sleep, glide, tap, typeSlow } from "./harness.mjs";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "footage");
fs.mkdirSync(out, { recursive: true });

const clips = {
  // Sign-in screen: typing an email
  async auth() {
    const { browser, page } = await openApp({ authed: false });
    await sleep(2500);
    await page.mouse.move(1400, 760);
    const stop = await startRecording(page, path.join(out, "auth.mp4"));
    await sleep(600);
    await tap(page, 'input[type="email"]', { steps: 40 });
    await typeSlow(page, "you@rochambeau.finance", 70);
    await sleep(500);
    await glide(page, 'button[type="submit"]', { steps: 30 });
    await sleep(900);
    await stop(); await browser.close();
  },

  // Live markets dashboard: browse symbols, ranges, movers
  async dashboard() {
    const { browser, page } = await openApp();
    await sleep(2000);
    await page.click('[data-testid="button-real-mode"]');
    await page.waitForSelector('[data-testid="terminal"]');
    await sleep(2500);
    await page.mouse.move(900, 500);
    const stop = await startRecording(page, path.join(out, "dashboard.mp4"));
    await sleep(1200);
    await tap(page, '[data-testid="watchlist-item-NVDA"]');
    await sleep(1600);
    await tap(page, '[data-testid="button-range-6M"]');
    await sleep(1600);
    await tap(page, '[data-testid="watchlist-item-MSFT"]');
    await sleep(1500);
    await tap(page, '[data-testid="button-range-1Y"]');
    await sleep(1400);
    await tap(page, '[data-testid="button-tab-losers"]');
    await sleep(1200);
    await tap(page, '[data-testid="mover-TSLA"]');
    await sleep(1600);
    await glide(page, { x: 1320, y: 840 }, { steps: 40 });
    await sleep(800);
    await stop(); await browser.close();
  },

  // Command bar: type a ticker that isn't on the watchlist yet
  async command() {
    const { browser, page } = await openApp();
    await sleep(2000);
    await page.click('[data-testid="button-real-mode"]');
    await page.waitForSelector('[data-testid="terminal"]');
    await sleep(2500);
    await page.mouse.move(700, 600);
    const stop = await startRecording(page, path.join(out, "command.mp4"));
    await sleep(700);
    await tap(page, '[data-testid="input-command"]', { steps: 35 });
    await sleep(300);
    await typeSlow(page, "PLTR", 180);
    await sleep(400);
    await page.keyboard.press("Enter");
    await sleep(2600);
    await tap(page, '[data-testid="input-command"]', { steps: 20 });
    await typeSlow(page, "AMD", 180);
    await page.keyboard.press("Enter");
    await sleep(2400);
    await stop(); await browser.close();
  },

  // Mode select -> simulation setup -> start
  async setup() {
    const { browser, page } = await openApp();
    await page.waitForSelector('[data-testid="mode-select"]');
    await sleep(1500);
    await page.mouse.move(700, 760);
    const stop = await startRecording(page, path.join(out, "setup.mp4"));
    await sleep(900);
    await glide(page, '[data-testid="button-real-mode"]', { steps: 30 });
    await sleep(500);
    await tap(page, '[data-testid="button-sim-mode"]', { steps: 30 });
    await sleep(900);
    if (await page.$('[data-testid="button-new-sim"]')) { await tap(page, '[data-testid="button-new-sim"]'); await sleep(800); }
    await tap(page, '[data-testid="cash-100000"]');
    await sleep(500);
    await tap(page, '[data-testid="variation-high"]');
    await sleep(600);
    await tap(page, '[data-testid="button-start-sim"]');
    await sleep(2200);
    await stop(); await browser.close();
  },

  // Simulation running: fast-forward time, buy shares, watch the portfolio move
  async sim() {
    const { browser, page } = await openApp();
    await page.waitForSelector('[data-testid="mode-select"]');
    await page.click('[data-testid="button-sim-mode"]');
    await sleep(800);
    if (await page.$('[data-testid="button-new-sim"]')) { await page.click('[data-testid="button-new-sim"]'); await sleep(500); }
    await page.click('[data-testid="variation-high"]');
    await page.click('[data-testid="button-start-sim"]');
    await page.waitForSelector('[data-testid="sim-terminal"]');
    await sleep(1500);
    if (await page.$('[data-testid="button-skip-tutorial"]')) await page.click('[data-testid="button-skip-tutorial"]');
    await sleep(2500);
    await page.mouse.move(800, 300);
    const stop = await startRecording(page, path.join(out, "sim.mp4"));
    await sleep(600);
    await tap(page, '[data-testid="watchlist-item-NVDA"]');
    await sleep(700);
    await tap(page, '[data-testid="tab-trade"]');
    await sleep(500);
    await tap(page, '[data-testid="input-shares"]');
    await typeSlow(page, "150", 160);
    await sleep(400);
    await tap(page, '[data-testid="button-execute-trade"]');
    await sleep(900);
    await tap(page, '[data-testid="tab-portfolio"]');
    await sleep(500);
    await tap(page, '[data-testid="speed-1day"]', { steps: 30 });
    await sleep(7000);
    await glide(page, { x: 1760, y: 720 }, { steps: 40 });
    await sleep(3500);
    await stop(); await browser.close();
  },

  // Live event: join from the banner, land on the leaderboard
  async event() {
    const { browser, page } = await openApp();
    await page.waitForSelector('[data-testid="event-banner"]');
    await sleep(1500);
    await page.mouse.move(800, 300);
    const stop = await startRecording(page, path.join(out, "event.mp4"));
    await sleep(800);
    await tap(page, '[data-testid="join-event-btn"]', { steps: 34 });
    await page.waitForSelector('[data-testid="event-terminal"]');
    await sleep(1500);
    if (await page.$('[data-testid="button-skip-tutorial"]')) { await tap(page, '[data-testid="button-skip-tutorial"]'); }
    await sleep(800);
    await glide(page, '[data-testid="event-leaderboard"]', { steps: 40 });
    await sleep(1200);
    await tap(page, '[data-testid="speed-1day"]', { steps: 30 });
    await sleep(4500);
    await stop(); await browser.close();
  },
};

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(clips);
const vite = await startDevServer();
try {
  for (const name of wanted) {
    console.log(`recording ${name}`);
    await clips[name]();
  }
} finally {
  vite.kill();
}
