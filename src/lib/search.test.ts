import { describe, expect, it } from 'vitest';
import { canSearch, isSearchShortcut } from './search';

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
