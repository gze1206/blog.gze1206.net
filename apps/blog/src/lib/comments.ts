/**
 * 글 상세의 댓글(Comentario) 임베드 값 (NOR-200, ADR 0019).
 *
 * 페이지 id 를 `postPath` 로 명시한다. Comentario 는 생략하면 `location.pathname` 을 쓰므로
 * `/blog/x` 와 `/blog/x/` 가 다른 댓글 목록이 된다.
 */
import { postPath } from './routes';

export const COMMENTS_ORIGIN = 'https://comments.gze1206.net';

export interface CommentsEmbed {
  scriptSrc: string;
  pageId: string;
  lang: 'ko';
}

export function commentsEmbed(slug: string): CommentsEmbed {
  return { scriptSrc: `${COMMENTS_ORIGIN}/comentario.js`, pageId: postPath(slug), lang: 'ko' };
}

export function commentsTheme(isDark: boolean): 'dark' | 'light' {
  return isDark ? 'dark' : 'light';
}
