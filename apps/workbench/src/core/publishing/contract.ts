import { strictPostSchema, type Post } from '@gze1206/content-contract';

/**
 * 워크벤치가 다루는 공개 글 메타데이터. 날짜는 직렬화하기 좋게 `YYYY-MM-DD` 문자열이다.
 * `toc` 는 초안에 있을 때만 있다 — 기본값을 매번 써 넣으면 모든 글의 diff 에 한 줄이 늘어난다.
 */
export type PublicPost = Omit<Post, 'publishedAt' | 'updatedAt' | 'toc'> & {
  readonly publishedAt: string;
  readonly updatedAt: string;
  readonly toc?: Post['toc'];
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

export function parsePublishedPost(input: unknown): PublicPost {
  const { publishedAt, updatedAt, toc, ...rest } = strictPostSchema.parse(input);
  const hasToc = typeof input === 'object' && input !== null && 'toc' in input;
  return {
    ...rest,
    publishedAt: toIsoDate(publishedAt),
    updatedAt: toIsoDate(updatedAt),
    ...(hasToc ? { toc } : {}),
  };
}
