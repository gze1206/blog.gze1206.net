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

/** 카테고리와 태그를 함께 탐색하는 통합 인덱스. */
export function topicsPath(): string {
  return '/topics';
}

/** 소개 — 홈의 한 줄보다 긴 이야기와 연락처 (NOR-156). */
export function aboutPath(): string {
  return '/about';
}

/** 경력 — 역할·기간·맥락을 시간순으로 읽는 곳 (NOR-151). */
export function careerPath(): string {
  return '/career';
}

/** 포트폴리오 — 공개 가능한 작업을 문제·역할·기술·결과로 보는 곳 (NOR-151). */
export function portfolioPath(): string {
  return '/portfolio';
}

export function seriesPath(slug: string): string {
  return `/series/${segment(slug)}`;
}

/** 경로를 URL 정책(선행 슬래시 1개, 끝 슬래시 없음, 루트만 `/`)으로 정규화한다 (ADR 0013). */
export function normalizePath(pathname: string): string {
  const collapsed = `/${pathname}`.replace(/\/{2,}/g, '/');
  const trimmed = collapsed.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * 페이지 경로 → 그 페이지의 OG 이미지 경로 (NOR-28).
 *
 * 규칙이 하나뿐이라 **메타가 가리키는 URL 과 엔드포인트가 만드는 파일이 어긋날 수 없다.**
 * 사이트 트리를 그대로 `/og` 아래에 복사한 모양이다.
 *
 * ```
 * /                 → /og/index.png
 * /blog/hello-world → /og/blog/hello-world.png
 * /tags/웹-성능      → /og/tags/웹-성능.png
 * ```
 *
 * 입력의 인코딩을 그대로 보존한다 — 퍼센트 인코딩된 경로를 넣으면 인코딩된 경로가 나온다.
 */
export function ogImagePath(pathname: string): string {
  const path = normalizePath(pathname);
  return path === '/' ? '/og/index.png' : `/og${path}.png`;
}

const OG_PREFIX = '/og/';
const OG_SUFFIX = '.png';

/**
 * 페이지 경로 → OG 이미지 엔드포인트(`src/pages/og/[...path].png.ts`)의 rest 파라미터.
 *
 * Astro 는 파라미터를 출력 경로에 넣을 때 스스로 인코딩하므로 **디코딩된 값**을 넘겨야 한다.
 * 이미 인코딩된 경로를 그대로 넘기면 `%` 가 다시 인코딩돼 `%25...` 파일이 생긴다.
 */
export function ogImageParam(pathname: string): string {
  const imagePath = ogImagePath(pathname);
  let decoded: string;
  try {
    decoded = decodeURIComponent(imagePath);
  } catch {
    // 잘못된 퍼센트 시퀀스는 디코딩하지 않고 그대로 쓴다(빌드를 세우지 않는다).
    decoded = imagePath;
  }
  return decoded.slice(OG_PREFIX.length, -OG_SUFFIX.length);
}
