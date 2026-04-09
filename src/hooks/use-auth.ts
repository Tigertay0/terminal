import { useState, useCallback, useEffect } from "react";
import { fetchJSON, postJSON, setAuthToken, clearAuthToken, getAuthToken } from "@/lib/finance-api";

export interface User {
  id: number;
  email: string;
  displayName: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if we have a token and validate it
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetchJSON<{ user: User }>("/api/auth/me")
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        clearAuthToken();
        setLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const data = await postJSON<{ user: User; token: string }>("/api/auth/login", { email, password });
      setAuthToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      const msg = err.message?.includes("401") ? "Invalid email or password" : "Login failed";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName?: string) => {
    setError(null);
    try {
      const data = await postJSON<{ user: User; token: string }>("/api/auth/signup", {
        email, password, displayName,
      });
      setAuthToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err: any) {
      const msg = err.message?.includes("409") ? "Account already exists" :
                  err.message?.includes("400") ? "Invalid input" : "Signup failed";
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
  };
}
