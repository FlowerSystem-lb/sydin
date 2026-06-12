"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getResolvedTheme,
  getStoredThemePreference,
  isThemePreference,
  persistThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/app/lib/theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>("dark");
  const [resolvedTheme, setResolvedTheme] =
    useState<ResolvedTheme>("dark");

  const updateTheme = useCallback((nextPreference: ThemePreference) => {
    const nextTheme = getResolvedTheme(nextPreference);
    setPreferenceState(nextPreference);
    setResolvedTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const setPreference = useCallback(
    (nextPreference: ThemePreference) => {
      persistThemePreference(nextPreference);
      updateTheme(nextPreference);
    },
    [updateTheme]
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      updateTheme(getStoredThemePreference());
    });

    return () => window.cancelAnimationFrame(frame);
  }, [updateTheme]);

  useEffect(() => {
    if (preference !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => updateTheme("system");

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [preference, updateTheme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;

      updateTheme(
        isThemePreference(event.newValue) ? event.newValue : "dark"
      );
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [updateTheme]);

  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.theme;
      document.documentElement.style.colorScheme = "dark";
    };
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className="dashboard-theme min-h-screen">{children}</div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}
