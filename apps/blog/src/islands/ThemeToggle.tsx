import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import {
  getThemeTogglePresentation,
  normalizeThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '../lib/theme';

function getPreference(): ThemePreference {
  try {
    return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

function applyPreference(preference: ThemePreference): void {
  const root = document.documentElement;
  const resolved = resolveTheme(
    preference,
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  window.dispatchEvent(new CustomEvent('themechange', { detail: { preference, resolved } }));
}

/**
 * 유일한 클라이언트 UI 아일랜드다. 버튼은 기본 `<button>`을 사용해 키보드 동작을 브라우저에
 * 맡기고, React는 저장값과 문서 클래스 동기화만 담당한다.
 */
export default function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [isHydrated, setIsHydrated] = useState(false);
  const [, refresh] = useState(0);

  useEffect(() => {
    const initial = getPreference();
    setPreference(initial);
    applyPreference(initial);
    setIsHydrated(true);

    const onThemeChange = () => refresh((value) => value + 1);
    window.addEventListener('themechange', onThemeChange);
    return () => window.removeEventListener('themechange', onThemeChange);
  }, []);

  const resolved =
    !isHydrated || typeof window === 'undefined'
      ? 'light'
      : resolveTheme(preference, window.matchMedia('(prefers-color-scheme: dark)').matches);
  const nextPreference: ThemePreference = resolved === 'dark' ? 'light' : 'dark';
  const { icon, label } = getThemeTogglePresentation(resolved);

  function toggleTheme(): void {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    } catch {
      // 사생활 보호 모드처럼 저장소가 막혀도 이번 문서에서는 전환을 제공한다.
    }
    setPreference(nextPreference);
    applyPreference(nextPreference);
  }

  return (
    <Button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
    >
      <span aria-hidden="true">{icon}</span>
    </Button>
  );
}
