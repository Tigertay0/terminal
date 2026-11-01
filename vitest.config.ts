import { defineConfig } from "vitest/config";

// API tests run in Node against the Hono app directly (no Vite plugins).
// worker/test/db.test.ts also needs the Neon dev branch; see README.
export default defineConfig({
  test: {
    include: ["worker/test/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
