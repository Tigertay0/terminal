import fs from "node:fs";
import { Config } from "@remotion/cli/config";

// Use the preinstalled headless shell instead of downloading one at render time
const HEADLESS_SHELL = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browser = process.env.REMOTION_BROWSER ?? (fs.existsSync(HEADLESS_SHELL) ? HEADLESS_SHELL : null);
if (browser) Config.setBrowserExecutable(browser);

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
