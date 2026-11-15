import { expect, it } from 'vitest';
import { verifyArticleLayout } from './verify-article-layout.mjs';

const VALID = `
  <main class="article">
    <article data-pagefind-body>
      <header class="article__head">
        <a href="/category/dev" class="category-badge">dev</a>
        <ul class="tag-chips"><li><a href="/tags/astro" class="tag-chip">astro</a></li></ul>
      </header>
      <details class="post-toc" open data-post-toc><summary>이 글의 목차</summary></details>
      <div class="post-body article__body"><article><p>본문</p></article></div>
    </article>
    <details class="post-toc-fab" data-post-toc-fab data-follows-scroll="true" hidden></details>
  </main>
`;

it('계약을 지킨 출력에는 지적할 것이 없다', () => {
  expect(verifyArticleLayout(VALID)).toEqual([]);
});

it('분류 표기가 링크가 아니면 잡아낸다', () => {
  const html = VALID.replace(
    '<a href="/category/dev" class="category-badge">dev</a>',
    '<span class="category-badge">dev</span>',
  ).replace(
    '<a href="/tags/astro" class="tag-chip">astro</a>',
    '<span class="tag-chip">astro</span>',
  );

  expect(verifyArticleLayout(html)).toEqual(['category must be a link', 'tags must be links']);
});

it('상단 목차가 닫힌 채 나가면 잡아낸다', () => {
  const html = VALID.replace(
    '<details class="post-toc" open data-post-toc>',
    '<details class="post-toc" data-post-toc>',
  );

  expect(verifyArticleLayout(html)).toContain('inline toc must be an open <details>');
});

it('스크롤을 따르는 플로팅 목차가 처음부터 보이면 잡아낸다', () => {
  const html = VALID.replace('data-follows-scroll="true" hidden', 'data-follows-scroll="true"');

  expect(verifyArticleLayout(html)).toContain('scroll-following toc fab must start hidden');
});

it('읽기 열과 머리 영역이 빠지면 잡아낸다', () => {
  expect(verifyArticleLayout('<main></main>')).toEqual(
    expect.arrayContaining([
      'article head is missing',
      'article body must carry the reading column class',
    ]),
  );
});
