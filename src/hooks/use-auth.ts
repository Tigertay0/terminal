import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * The signed-in user, from Better Auth. Every component that calls this shares
 * one session store, so signing in or out anywhere updates them all.
 */
export function useAuth() {
  const session = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  // Better Auth refetches the session on tab focus and reports it as pending
  // again; only the first lookup should hold the app on its splash screen
  // (later ones would unmount a half-filled sign-in form).
  const [resolvedOnce, setResolvedOnce] = useState(false);
  useEffect(() => {
    if (!session.isPending) setResolvedOnce(true);
  }, [session.isPending]);
  const user = session.data?.user ?? null;

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      const message = error.message || "Could not sign in.";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName?: string) => {
    setError(null);
    const { error } = await authClient.signUp.email({
      email,
      password,
      // Shown on event leaderboards. Left empty, the server picks a "Trader 1234"
      // name rather than exposing part of the email address.
      name: (displayName?.trim() ?? "").slice(0, 40),
    });
    if (error) {
      const message = error.message || "Could not create the account.";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async () => {
    const { error } = await authClient.signOut();
    if (error) {
      setError(error.message || "Could not sign out.");
      throw new Error(error.message);
    }
  }, []);

  return {
    user,
    userId: user?.id ?? null,
    displayName: user?.name || "Anonymous",
    isAuthenticated: !!user,
    loading: session.isPending && !resolvedOnce,
    error: error ?? (session.error ? "Could not restore your session. Please log in again." : null),
    login,
    signup,
    logout,
  };
}
