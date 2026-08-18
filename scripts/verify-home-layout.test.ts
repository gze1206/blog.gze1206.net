import { expect, it } from 'vitest';
import { verifyHomeLayout } from './verify-home-layout.mjs';

const VALID = `
  <main class="home">
    <section aria-labelledby="about-heading"><h1 id="about-heading">만들고, 고치고, 기록합니다</h1></section>
    <section aria-labelledby="recent-posts-heading"><h2 id="recent-posts-heading">최근 기록</h2></section>
    <section aria-labelledby="doors-heading">
      <a href="/about">소개</a>
      <a href="/portfolio">포트폴리오</a>
    </section>
  </main>
`;

it('입구 구조를 갖춘 홈에는 지적할 것이 없다', () => {
  expect(verifyHomeLayout(VALID)).toEqual([]);
});

it('캔버스와 빠진 섹션을 함께 잡아낸다', () => {
  const html = '<main><canvas></canvas><h1>gze1206</h1></main>';

  expect(verifyHomeLayout(html)).toEqual([
    'canvas must not be present',
    'about section is missing',
    'recent posts section is missing',
    'career/portfolio doors are missing',
    'about door link is missing',
    'portfolio door link is missing',
  ]);
});

it('두 입구 중 하나만 있어도 잡아낸다', () => {
  const html = VALID.replace('<a href="/portfolio">포트폴리오</a>', '');

  expect(verifyHomeLayout(html)).toEqual(['portfolio door link is missing']);
});

it('홈에 프로젝트 목록이 돌아오면 잡아낸다', () => {
  const html = VALID.replace('</main>', '<div class="home-project-grid"></div></main>');

  expect(verifyHomeLayout(html)).toEqual([
    'projects must live on the portfolio page, not the home page',
  ]);
});
