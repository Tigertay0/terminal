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

export function googleConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/**
 * The only auth endpoints a browser may call. Everything else Better Auth
 * ships (profile updates, account deletion, session listing...) stays closed
 * until the app has a screen for it.
 */
function publicPaths(env: Env): Set<string> {
  const paths = ["/get-session", "/sign-out", "/sign-in/email", "/sign-up/email"];
  if (googleConfigured(env)) paths.push("/sign-in/social", "/callback/:id");
  return new Set(paths);
}

/** Trims a display name and drops control characters; it is shown to other players. */
export function cleanDisplayName(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim();
}

export function authOptions(env: Env, pool: Pool, waitUntil?: (promise: Promise<unknown>) => void) {
  const url = env.BETTER_AUTH_URL?.trim() ?? "";
  if (!/^https:\/\/|^http:\/\/localhost(:\d+)?$/.test(url)) {
    throw new Error("BETTER_AUTH_URL must be the site's https:// address (or http://localhost locally).");
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
          before: async (user) => {
            const name = cleanDisplayName(user.name) || user.email.split("@")[0]!.slice(0, MAX_NAME_LENGTH);
            if (name.length > MAX_NAME_LENGTH) {
              throw new APIError("BAD_REQUEST", { message: `Display name must be ${MAX_NAME_LENGTH} characters or fewer.` });
            }
            return { data: { ...user, name } };
          },
        },
      },
      session: {
        create: {
          // Nothing reads these, so they are not kept.
          before: async (session) => ({ data: { ...session, ipAddress: null, userAgent: null } }),
        },
      },
    },

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
