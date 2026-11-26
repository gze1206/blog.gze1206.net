/**
 * 글 상세의 댓글(Comentario) 임베드 값 (NOR-200, ADR 0019).
 *
 * 페이지 id 를 `postPath` 로 명시한다. Comentario 는 생략하면 `location.pathname` 을 쓰므로
 * `/blog/x` 와 `/blog/x/` 가 다른 댓글 목록이 된다.
 */
import { postPath } from './routes';
import type { Lang } from './i18n';

export const COMMENTS_ORIGIN = 'https://comments.gze1206.net';

/**
 * Comentario 3.19.0 `comentario.js` 의 SRI 해시. 서버나 그 앞단이 스크립트를 바꾸면 브라우저가 실행하지
 * 않는다. 서버 이미지를 갱신하면 이 값도 함께 바꾼다. `pnpm check:domains` 가 서버 본문과 대조한다.
 */
export const COMMENTS_SCRIPT_INTEGRITY =
  'sha384-LYPL1k9kCcfh4ZPBcswQmv3+cpWNdOKY2o+n/PV1uXIOgtS9ineQX7SBxONqjvhU';

export interface CommentsEmbed {
  scriptSrc: string;
  integrity: string;
  pageId: string;
  lang: Lang;
}

interface PostRef {
  readonly slug: string;
  readonly lang: Lang;
}

/**
 * 댓글 묶음 경로(NOR-253). 같은 글은 언어가 달라도 한 묶음을 본다: 한국어 글은 자기 경로,
 * 한국어판이 있는 영어 글은 한국어판 경로, 없으면 자기 경로다. 한국어 글의 기존 묶음은 바뀌지 않는다.
 */
export function commentThreadPath(post: PostRef, translation: PostRef | undefined): string {
  if (post.lang !== 'ko' && translation?.lang === 'ko') return postPath(translation.slug, 'ko');
  return postPath(post.slug, post.lang);
}

/** 위젯 문구는 페이지 언어를 따르고, 묶음은 `threadPath`(없으면 글 경로)다. */
export function commentsEmbed(slug: string, lang: Lang = 'ko', threadPath?: string): CommentsEmbed {
  return {
    scriptSrc: `${COMMENTS_ORIGIN}/comentario.js`,
    integrity: COMMENTS_SCRIPT_INTEGRITY,
    pageId: threadPath ?? postPath(slug, lang),
    lang,
  };
}

export function commentsTheme(isDark: boolean): 'dark' | 'light' {
  return isDark ? 'dark' : 'light';
}
