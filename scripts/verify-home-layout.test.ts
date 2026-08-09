import { expect, it } from 'vitest';
import { verifyHomeLayout } from './verify-home-layout.mjs';

it('홈은 캔버스 없이 포트폴리오 정보 위계를 렌더한다', () => {
  const html = '<main><canvas></canvas><h1>gze1206</h1></main>';

  expect(verifyHomeLayout(html)).toEqual([
    'canvas must not be present',
    'portfolio section is missing',
    'recent posts section is missing',
  ]);
});

it('홈 히어로에서는 소개와 기술 섹션 표지도 요구한다', () => {
  const html = `
    <main>
      <section class="home-hero">
        <h1 id="about-heading">gze1206</h1>
      </section>
      <section id="portfolio-heading"></section>
      <section id="recent-posts-heading"></section>
    </main>
  `;

  expect(verifyHomeLayout(html)).toEqual(['stack section is missing']);
});
