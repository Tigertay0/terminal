import { useCallback, useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * The signed-in user, from Better Auth. Every component that calls this shares
 * one session store, so signing in or out anywhere updates them all.
 */
export function useAuth() {
  const session = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
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
      // Shown on event leaderboards; the server allows up to 40 characters.
      name: (displayName?.trim() || email.split("@")[0]).slice(0, 40),
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
    displayName: user?.name || user?.email?.split("@")[0] || "Anonymous",
    isAuthenticated: !!user,
    loading: session.isPending,
    error: error ?? (session.error ? "Could not restore your session. Please log in again." : null),
    login,
    signup,
    logout,
  };
}
