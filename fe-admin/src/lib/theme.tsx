"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "echo-theme";

type ThemeContextValue = {
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Inline, render-blocking snippet that applies the persisted theme to
 * <html> before React hydrates — prevents a flash of the wrong theme.
 * Light is the default; dark is only used when explicitly persisted.
 */
export const themeNoFlashScript = `(() => {
  try {
    if (localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) !== "dark") {
      document.documentElement.classList.add("light");
    }
  } catch (e) {
    document.documentElement.classList.add("light");
  }
})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize from the class the no-flash script already applied, so the
  // initial state matches the DOM and there is no flicker on mount.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("light")
        ? "light"
        : "dark";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable — ignore */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggle = useCallback(
    () => setThemeState((prev) => (prev === "dark" ? "light" : "dark")),
    [],
  );

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
