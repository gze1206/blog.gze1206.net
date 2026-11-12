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

/** 보이는 전환 아이콘과 접근성 이름을 한 계약으로 관리한다. */
export function getThemeTogglePresentation(resolved: ResolvedTheme): {
  readonly icon: string;
  readonly label: string;
} {
  if (resolved === 'dark') return { icon: '☀︎', label: '☀︎ 라이트 모드로 전환' };
  return { icon: '☾', label: '☾ 다크 모드로 전환' };
}
