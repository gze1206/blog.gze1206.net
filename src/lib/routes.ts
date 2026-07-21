/**
 * URL 조립의 단일 출처 (NOR-16, ADR 0009).
 *
 * 경로 문자열을 템플릿 리터럴로 여기저기 흩어놓으면 라우트 구조를 바꿀 때 반드시 하나를 놓친다.
 * 슬러그에 한글이 올 수 있으므로 세그먼트는 항상 퍼센트 인코딩한다.
 */

function segment(value: string): string {
  return encodeURIComponent(value);
}

/** 글 상세. 프론트매터 slug 기준. */
export function postPath(slug: string): string {
  return `/blog/${segment(slug)}`;
}

/** 목록 페이지네이션. 1페이지는 `/blog` 로 고정해 중복 URL 을 만들지 않는다. */
export function blogPagePath(pageNumber: number): string {
  return pageNumber <= 1 ? '/blog' : `/blog/${pageNumber}`;
}

export function categoryPath(slug: string): string {
  return `/category/${segment(slug)}`;
}

export function tagPath(slug: string): string {
  return `/tags/${segment(slug)}`;
}

export function seriesPath(slug: string): string {
  return `/series/${segment(slug)}`;
}
