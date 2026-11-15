/** 워크벤치 테마 (NOR-203). 블로그와 같은 규칙: light·dark·system, `<html class="dark">`. */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** index.html 의 초기화 스크립트와 같은 키다. 블로그(gze1206-theme)와 다른 출처라 키를 나눌 필요는 없지만 구분해 둔다. */
export const THEME_STORAGE_KEY = 'workbench-theme';

export function parsePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}
