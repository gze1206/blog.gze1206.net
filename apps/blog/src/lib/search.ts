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

/**
 * 이 플랫폼이 Apple 계열인가 (NOR-164).
 *
 * `navigator.platform` 은 폐기 예정이고 `navigator.userAgentData` 는 아직 모든 브라우저에
 * 없다. 그래서 판단은 **문자열 하나를 받는 순수 함수**로 떼어 두고, 어디서 그 문자열을
 * 구하는지는 호출부가 정한다.
 */
export function isApplePlatform(platform: string | undefined): boolean {
  if (platform === undefined) return false;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/**
 * 검색 단축키의 화면 표기.
 *
 * 처리는 ⌘K 와 Ctrl+K 를 모두 받지만(`isSearchShortcut`), 안내는 그 플랫폼에서 실제로 쓰는
 * 조합 하나만 보여 준다. 둘 다 적으면 읽는 사람이 자기 것을 골라내야 한다.
 */
export function searchShortcutLabel(platform: string | undefined): string {
  return isApplePlatform(platform) ? '⌘K' : 'Ctrl K';
}
