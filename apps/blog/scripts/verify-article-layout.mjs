/**
 * 글 상세 출력이 읽기 레이아웃의 계약을 지키는지 확인한다 (NOR-150).
 *
 * 여기서 보는 것은 **표현이 아니라 계약**이다. 분류 표기가 링크인지, 목차가 스크립트 없이도
 * 열리는 마크업인지처럼, 깨져도 빌드는 통과하지만 탐색이 끊기는 것들만 본다.
 */

/**
 * @param {string} html 빌드된 글 상세 페이지 HTML
 * @returns {string[]} 위반 목록. 비어 있으면 통과.
 */
export function verifyArticleLayout(html) {
  const problems = [];

  if (!html.includes('class="article__head"')) {
    problems.push('article head is missing');
  }
  if (!html.includes('post-body article__body')) {
    problems.push('article body must carry the reading column class');
  }

  // 카테고리·태그는 실제 링크여야 한다. 장식으로 끝나면 글에서 탐색으로 이어지지 않는다.
  if (!/<a [^>]*href="[^"]+"[^>]*class="category-badge"/.test(html)) {
    problems.push('category must be a link');
  }
  if (!/<a [^>]*href="[^"]+"[^>]*class="tag-chip"/.test(html)) {
    problems.push('tags must be links');
  }

  // 상단 목차는 `<details open>` 이어야 한다 — 스크립트 없이 열려 있어야 하기 때문이다.
  // `data-post-toc-fab` 과 헷갈리지 않도록 속성 이름의 끝까지 본다.
  if (/data-post-toc(?![\w-])/.test(html)) {
    if (!/<details class="post-toc" open/.test(html)) {
      problems.push('inline toc must be an open <details>');
    }
  }

  // 스크롤을 따르는 플로팅 목차는 처음에 숨어 있어야 한다. 스크립트가 없으면 계속 숨는다.
  if (/data-follows-scroll="true"/.test(html) && !/data-post-toc-fab[^>]*hidden/.test(html)) {
    problems.push('scroll-following toc fab must start hidden');
  }

  return problems;
}
