import { useState, useEffect, useCallback } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "rochambeau-theme";
const LEGACY_STORAGE_KEY = "bb-terminal-theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first (falling back to the pre-rebrand key), default to dark
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored === "light" || stored === "dark") return stored;
    }
    return "dark";
  });

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  return { theme, toggleTheme, setTheme };
}
