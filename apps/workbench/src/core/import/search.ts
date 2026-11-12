/**
 * 가져올 글 찾기 (NOR-187).
 *
 * 블로그 글이 서른 편일 때는 전부 펼쳐 놓아도 눈으로 찾을 수 있었지만, 그 수는 줄지 않는다.
 * 목록을 좁히는 일은 서버에 물어볼 것이 없다 — 이미 다 받아 온 목록이므로 여기서 거른다.
 */
export interface SearchablePost {
  readonly title: string;
  readonly slug: string;
}

/**
 * 제목이나 slug 에 검색어가 들어 있는 글만 남긴다.
 *
 * 띄어쓰기는 무시한다 — "클린 아키텍처"를 "클린아키텍처"로 쳐도 찾아야 한다. 검색어가 비면
 * 거르지 않고 원래 목록을 그대로 돌려준다.
 */
export function matchImportablePosts<T extends SearchablePost>(
  posts: readonly T[],
  query: string,
): T[] {
  const needle = normalize(query);
  if (needle === '') return [...posts];
  return posts.filter(
    (post) => normalize(post.title).includes(needle) || normalize(post.slug).includes(needle),
  );
}

function normalize(value: string): string {
  return value.normalize('NFC').toLowerCase().replace(/\s+/gu, '');
}
