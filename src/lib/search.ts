/** 브라우저 키보드 이벤트에서 검색 팔레트 단축키만 판별한다. */
export function isSearchShortcut(event: {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
}): boolean {
  return event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
}

/** Pagefind 요청은 의미 있는 두 글자 이상의 검색어에서만 시작한다. */
export function canSearch(query: string): boolean {
  return query.trim().length >= 2;
}
