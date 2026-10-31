/** Bindings and secrets the Worker receives (see wrangler.jsonc). */
export interface Env {
  /** Cloudflare's connection pool in front of the Neon database. */
  HYPERDRIVE: { connectionString: string };
  /** Per-user limit on AI news calls, which spend Anthropic API credits. */
  NEWS_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /** The site's own address, e.g. https://terminal.tiger-tayo.workers.dev */
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  /** For AI news (Claude Haiku 5.5); without it the sim uses its built-in news only. */
  ANTHROPIC_API_KEY?: string;
  /** Google sign-in is offered only when both are set. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}
