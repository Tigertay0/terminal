import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { Pool } from "pg";
import type { Env } from "./env";

/**
 * Accounts on Better Auth, with users stored in the app's own Postgres:
 * email + password with a display name, and Google when its keys are set.
 */

const DAY = 60 * 60 * 24;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NAME_LENGTH = 40;

/** Better Auth's camelCase field names mapped onto snake_case columns. */
function snake<T extends string>(fields: readonly T[]): Record<T, string> {
  return Object.fromEntries(
    fields.map((field) => [field, field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)]),
  ) as Record<T, string>;
}

const MIN_SECRET_LENGTH = 32;

export function googleConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/**
 * The only auth endpoints a browser may call, as Better Auth names them.
 * Everything else it ships (profile updates, account deletion, session
 * listing...) stays closed until the app has a screen for it.
 */
function publicPaths(env: Env): Set<string> {
  const paths = ["/get-session", "/sign-out", "/sign-in/email", "/sign-up/email"];
  if (googleConfigured(env)) paths.push("/sign-in/social", "/callback/:id");
  return new Set(paths);
}

/**
 * Whether a request path under /api/auth is one the app uses. Checked before a
 * database connection is opened, so other paths cost nothing.
 */
export function isPublicAuthPath(env: Env, path: string): boolean {
  const endpoint = path.replace(/^\/api\/auth/, "");
  if (endpoint === "/callback/google") return googleConfigured(env);
  return endpoint !== "/callback/:id" && publicPaths(env).has(endpoint);
}

/**
 * A display name as other players will see it: normalised, without control or
 * invisible formatting characters (zero-width, bidi overrides), at most
 * MAX_NAME_LENGTH long, and empty unless it has a letter or digit.
 */
export function cleanDisplayName(value: unknown): string {
  const name = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  return /[\p{L}\p{N}]/u.test(name) ? name : "";
}

/** For accounts created without a usable name; never derived from the email. */
function defaultDisplayName(): string {
  return `Trader ${Math.floor(1000 + Math.random() * 9000)}`;
}

export function authOptions(env: Env, pool: Pool, waitUntil?: (promise: Promise<unknown>) => void) {
  const url = env.BETTER_AUTH_URL?.trim() ?? "";
  if (!/^https:\/\/|^http:\/\/localhost(:\d+)?$/.test(url)) {
    throw new Error("BETTER_AUTH_URL must be the site's https:// address (or http://localhost locally).");
  }
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < MIN_SECRET_LENGTH) {
    throw new Error(`BETTER_AUTH_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters.`);
  }
  const allowed = publicPaths(env);

  return {
    appName: "Rochambeau Finance Terminal",
    baseURL: url,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [url],
    database: pool,

    user: {
      modelName: "users",
      fields: snake(["emailVerified", "createdAt", "updatedAt"] as const),
    },
    session: {
      modelName: "sessions",
      fields: snake(["expiresAt", "createdAt", "updatedAt", "ipAddress", "userAgent", "userId"] as const),
      expiresIn: 30 * DAY,
      updateAge: DAY,
    },
    account: {
      modelName: "accounts",
      fields: snake([
        "accountId",
        "providerId",
        "userId",
        "accessToken",
        "refreshToken",
        "idToken",
        "accessTokenExpiresAt",
        "refreshTokenExpiresAt",
        "createdAt",
        "updatedAt",
      ] as const),
    },
    verification: {
      modelName: "verifications",
      fields: snake(["expiresAt", "createdAt", "updatedAt"] as const),
    },

    // No email is sent: the old app had no verification or reset flow either.
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
    },
    socialProviders: googleConfigured(env)
      ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! } }
      : {},

    databaseHooks: {
      user: {
        create: {
          // Google names longer than the limit are shortened, not refused, and
          // nothing from the sign-up body is kept as a profile image.
          before: async (user) => ({
            data: { ...user, name: cleanDisplayName(user.name) || defaultDisplayName(), image: null },
          }),
        },
      },
      session: {
        create: {
          // Nothing reads these, so they are not kept.
          before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }),
        },
      },
    },

    // OAuth failures (Google consent declined, expired state) land back in the app.
    onAPIError: { errorURL: `${url}/` },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.request && !allowed.has(ctx.path)) {
          throw new APIError("NOT_FOUND", { message: "Not available." });
        }
      }),
    },

    // Per client address; IPv6 clients are grouped by their /64.
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "auth_rate_limits",
      fields: snake(["lastRequest"] as const),
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60 * 60, max: 5 },
      },
    },

    advanced: {
      cookiePrefix: "terminal",
      useSecureCookies: url.startsWith("https://"),
      // Cloudflare sets this to the real visitor address; nothing else is trusted.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"], ipv6Subnet: 64 },
      database: {
        generateId: "uuid",
        // A new instance is built per request; validating would introspect the
        // database every time.
        validateSchema: false,
      },
      ...(waitUntil ? { backgroundTasks: { handler: waitUntil } } : {}),
    },
  } satisfies BetterAuthOptions;
}

export function createAuth(env: Env, pool: Pool, waitUntil?: (promise: Promise<unknown>) => void) {
  return betterAuth(authOptions(env, pool, waitUntil));
}

export type Auth = ReturnType<typeof createAuth>;
