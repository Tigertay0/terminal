// Runs `vite` (the app plus the /api Worker) against the Neon dev branch.
//
// The dev branch's connection string is read from .secrets/neon-dev-worker.url
// (kept out of git) and handed to wrangler's local Hyperdrive. It is never printed.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const urlFile = join(root, ".secrets", "neon-dev-worker.url");
const env = { ...process.env };

if (existsSync(urlFile)) {
  env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE = readFileSync(urlFile, "utf8").trim();
} else if (!env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE) {
  console.warn("No .secrets/neon-dev-worker.url: sign-in and saved data will not work locally (see README).");
}

const vite = spawn("npx", ["vite", ...process.argv.slice(2)], { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
vite.on("exit", (code) => process.exit(code ?? 0));
