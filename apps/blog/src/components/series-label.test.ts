import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

describe('시리즈 라벨 연결 (NOR-241)', () => {
  it('NOR-241 AC-5: 글 카드는 제목 위에 시리즈 라벨을 두고 카드 전체를 링크로 감싸지 않는다', async () => {
    const card = await read('./PostCard.astro');
    expect(card).toContain('SeriesLabel');
    expect(card.indexOf('<SeriesLabel')).toBeLessThan(card.indexOf('<Heading'));
    expect(card).not.toMatch(/<article[^>]*>\s*<a\s/u);
  });

  it('NOR-241 AC-6: 상세 헤더·검색 결과도 같은 라벨 문구를 쓴다', async () => {
    const layout = await read('../layouts/PostLayout.astro');
    expect(layout).toContain('<SeriesLabel');
    expect(layout.indexOf('<SeriesLabel')).toBeLessThan(layout.indexOf('<h1'));
    const label = await read('./SeriesLabel.astro');
    expect(label).toContain('data-pagefind-meta');
    const palette = await read('../islands/SearchPalette.tsx');
    expect(palette).toContain('meta.series');
  });
});
