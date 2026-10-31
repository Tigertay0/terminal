import { createApp } from "./app";
import type { Env } from "./env";

// Requests to /api/* reach this Worker first (assets.run_worker_first in
// wrangler.jsonc); everything else is the built app, served as static assets.
const app = createApp();

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
