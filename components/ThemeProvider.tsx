"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  applyTheme,
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
  const setPreference = useCallback(() => {
    persistThemePreference("light");
    applyTheme("light");
  }, []);

  useEffect(() => {
    applyTheme("light");
  }, []);

  const value = useMemo(
    () => ({
      preference: "light" as ThemePreference,
      resolvedTheme: "light" as ResolvedTheme,
      setPreference,
    }),
    [setPreference]
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
