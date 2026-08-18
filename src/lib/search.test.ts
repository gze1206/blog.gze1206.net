import { describe, expect, it } from 'vitest';
import { canSearch, isApplePlatform, isSearchShortcut, searchShortcutLabel } from './search';

describe('isSearchShortcut', () => {
  it('⌘K 또는 Ctrl+K만 검색 팔레트 단축키로 인정한다', () => {
    expect(isSearchShortcut({ key: 'k', metaKey: true, ctrlKey: false })).toBe(true);
    expect(isSearchShortcut({ key: 'K', metaKey: false, ctrlKey: true })).toBe(true);
    expect(isSearchShortcut({ key: 'k', metaKey: false, ctrlKey: false })).toBe(false);
    expect(isSearchShortcut({ key: 'x', metaKey: true, ctrlKey: false })).toBe(false);
  });
});

describe('canSearch', () => {
  it('공백을 제외한 두 글자부터 Pagefind 검색을 시작한다', () => {
    expect(canSearch(' a ')).toBe(false);
    expect(canSearch(' 아 ')).toBe(false);
    expect(canSearch(' Astro ')).toBe(true);
    expect(canSearch('검색')).toBe(true);
  });
});

describe('searchShortcutLabel', () => {
  it('Apple 계열에서는 ⌘K 로 안내한다', () => {
    expect(searchShortcutLabel('MacIntel')).toBe('⌘K');
    expect(searchShortcutLabel('iPhone')).toBe('⌘K');
  });

  it('그 밖에서는 Ctrl K 로 안내한다', () => {
    expect(searchShortcutLabel('Win32')).toBe('Ctrl K');
    expect(searchShortcutLabel('Linux x86_64')).toBe('Ctrl K');
  });

  it('플랫폼을 알 수 없으면 Ctrl K 로 둔다 — 다수가 그렇다', () => {
    expect(searchShortcutLabel(undefined)).toBe('Ctrl K');
    expect(isApplePlatform(undefined)).toBe(false);
  });
});
