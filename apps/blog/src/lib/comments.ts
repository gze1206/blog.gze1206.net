/**
 * 글 상세의 댓글(Comentario) 임베드 값 (NOR-200, ADR 0019).
 *
 * 페이지 id 를 `postPath` 로 명시한다. Comentario 는 생략하면 `location.pathname` 을 쓰므로
 * `/blog/x` 와 `/blog/x/` 가 다른 댓글 목록이 된다.
 */
import { postPath } from './routes';

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
  lang: 'ko';
}

export function commentsEmbed(slug: string): CommentsEmbed {
  return {
    scriptSrc: `${COMMENTS_ORIGIN}/comentario.js`,
    integrity: COMMENTS_SCRIPT_INTEGRITY,
    pageId: postPath(slug),
    lang: 'ko',
  };
}

export function commentsTheme(isDark: boolean): 'dark' | 'light' {
  return isDark ? 'dark' : 'light';
}
