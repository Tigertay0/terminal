import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error("getSession error", error);
          setError("Could not restore your session. Please log in again.");
        }
        setUser(data.session?.user ?? null);
      })
      .catch((err) => {
        console.error("getSession failed", err);
        setError("Could not restore your session. Please log in again.");
      })
      // Always leave the splash screen, even when the session lookup fails
      .finally(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName?: string) => {
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName ?? email.split("@")[0] },
      },
    });
    if (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      throw error;
    }
  }, []);

  return {
    user,
    userId: user?.id ?? null,
    isAuthenticated: !!user,
    loading,
    error,
    login,
    signup,
    logout,
  };
}
