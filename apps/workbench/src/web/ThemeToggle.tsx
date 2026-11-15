import { useEffect, useState } from 'react';

import { parsePreference, resolveTheme, THEME_STORAGE_KEY, type ResolvedTheme } from './theme.js';

function systemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function currentTheme(): ResolvedTheme {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // 저장소를 못 쓰면 시스템 설정을 따른다.
  }
  return resolveTheme(parsePreference(stored), systemDark());
}

function apply(theme: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

/** 지금 보이는 테마의 반대로 바꾸고 그 선택을 저장한다(블로그와 같은 동작). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<ResolvedTheme>(() => currentTheme());

  useEffect(() => {
    apply(theme);
  }, [theme]);

  const next: ResolvedTheme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      aria-label={next === 'dark' ? '다크 모드로 전환' : '라이트 모드로 전환'}
      className="border-border bg-surface text-muted-strong hover:border-border-strong hover:text-foreground flex size-9 items-center justify-center rounded-full border text-base"
      onClick={() => {
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // 저장하지 못해도 이번 화면에는 적용한다.
        }
        setTheme(next);
      }}
      title={next === 'dark' ? '다크 모드로 전환' : '라이트 모드로 전환'}
      type="button"
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </button>
  );
}
