import { describe, expect, it } from 'vitest';
import * as theme from './theme';
import { normalizeThemePreference, resolveTheme } from './theme';

describe('normalizeThemePreference', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['system', 'system'],
    [null, 'system'],
    ['unexpected', 'system'],
  ] as const)('저장값 %s를 %s로 정규화한다', (value, expected) => {
    expect(normalizeThemePreference(value)).toBe(expected);
  });
});

describe('resolveTheme', () => {
  it.each([
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['system', true, 'dark'],
    ['system', false, 'light'],
  ] as const)('%s 선호와 시스템 다크=%s를 %s로 해석한다', (preference, prefersDark, expected) => {
    expect(resolveTheme(preference, prefersDark)).toBe(expected);
  });
});

describe('getThemeTogglePresentation', () => {
  it.each([
    ['dark', { icon: '☀︎', label: '☀︎ 라이트 모드로 전환' }],
    ['light', { icon: '☾', label: '☾ 다크 모드로 전환' }],
  ] as const)('보이는 %s 모드 아이콘을 접근성 이름에도 포함한다', (resolved, expected) => {
    expect('getThemeTogglePresentation' in theme).toBe(true);
    if (!('getThemeTogglePresentation' in theme)) return;

    expect(theme.getThemeTogglePresentation(resolved)).toEqual(expected);
  });
});
