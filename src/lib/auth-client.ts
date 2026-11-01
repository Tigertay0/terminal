import { createAuthClient } from "better-auth/react";

// Same-origin: the Worker serves Better Auth at /api/auth.
export const authClient = createAuthClient({ basePath: "/api/auth" });

export type SessionUser = NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"];
