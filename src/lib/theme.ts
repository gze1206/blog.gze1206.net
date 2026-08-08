export const THEME_STORAGE_KEY = 'gze1206-theme';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export function normalizeThemePreference(value: string | null): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}
