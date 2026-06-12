export const THEME_STORAGE_KEY = "sydin:appearance";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "dark";

  try {
    const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(storedValue) ? storedValue : "dark";
  } catch {
    return "dark";
  }
}

export function resolveTheme(
  preference: ThemePreference,
  prefersLight = false
): ResolvedTheme {
  if (preference === "system") {
    return prefersLight ? "light" : "dark";
  }

  return preference;
}

export function getResolvedTheme(
  preference: ThemePreference
): ResolvedTheme {
  if (typeof window === "undefined") {
    return preference === "light" ? "light" : "dark";
  }

  return resolveTheme(
    preference,
    window.matchMedia("(prefers-color-scheme: light)").matches
  );
}

export function applyTheme(theme: ResolvedTheme) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function persistThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The selected theme still applies for this page when storage is blocked.
  }
}

