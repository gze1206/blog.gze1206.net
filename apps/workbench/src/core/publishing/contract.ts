import { strictPostSchema, type Post } from '@gze1206/content-contract';

/**
 * 워크벤치가 다루는 공개 글 메타데이터. 날짜는 문서에 적힌 문자열(시각 포함)을 그대로 둔다(NOR-209 AC-1).
 * `toc` 는 초안에 있을 때만 있다 — 기본값을 매번 써 넣으면 모든 글의 diff 에 한 줄이 늘어난다.
 */
export type PublicPost = Omit<Post, 'publishedAt' | 'updatedAt' | 'toc'> & {
  readonly publishedAt: string;
  readonly updatedAt: string;
  readonly toc?: Post['toc'];
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

/** 원래 적힌 날짜 문자열이 있으면 그대로, 없으면(Date 로 들어온 값) 날짜만 쓴다. */
const keepDate = (raw: unknown, parsed: Date): string =>
  typeof raw === 'string' && raw.trim() !== '' ? raw : toIsoDate(parsed);

export function parsePublishedPost(input: unknown): PublicPost {
  const { publishedAt, updatedAt, toc, ...rest } = strictPostSchema.parse(input);
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const hasToc = 'toc' in raw;
  return {
    ...rest,
    publishedAt: keepDate(raw['publishedAt'], publishedAt),
    updatedAt: keepDate(raw['updatedAt'], updatedAt),
    ...(hasToc ? { toc } : {}),
  };
}
