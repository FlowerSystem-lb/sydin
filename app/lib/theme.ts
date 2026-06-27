export const THEME_STORAGE_KEY = "sydin:appearance";

export type ThemePreference = "light";
export type ResolvedTheme = "light";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light";
}

export function getStoredThemePreference(): ThemePreference {
  return "light";
}

export function resolveTheme(
  preference: ThemePreference,
  prefersLight = true
): ResolvedTheme {
  void preference;
  void prefersLight;
  return "light";
}

export function getResolvedTheme(
  preference: ThemePreference
): ResolvedTheme {
  return resolveTheme(preference);
}

export function applyTheme(theme: ResolvedTheme) {
  if (typeof document === "undefined") return;

  void theme;
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
}

export function persistThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") return;

  void preference;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
  } catch {
    // The light workspace still applies for this page when storage is blocked.
  }
}
