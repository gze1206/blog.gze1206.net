import { describe, expect, it } from 'vitest';
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
