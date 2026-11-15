import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

describe('태그 아이콘 (NOR-223)', () => {
  it('NOR-223 AC-1: 글 카드는 태그 앞에 # 를 붙이지 않고 아이콘 클래스를 쓴다', async () => {
    const card = await read('../components/PostCard.astro');
    expect(card).not.toContain('#{tag}');
    expect(card).toContain('tag-icon');
  });

  it('NOR-223 AC-2: 아이콘은 글자색을 따르는 SVG 마스크이고 # 글자를 그리지 않는다', async () => {
    const css = await read('./global.css');
    expect(css).not.toMatch(/\.tag-chip::before\s*\{[^}]*content:\s*'#'/u);
    const rule = /\.tag-icon::before\s*\{([^}]*)\}/u.exec(css)?.[1] ?? '';
    expect(rule).toContain("content: ''");
    expect(rule).toContain('background-color: currentColor');
    expect(rule).toMatch(/mask(-image)?:[^;]*url\("data:image\/svg\+xml/u);
  });

  it('NOR-223 AC-3: 태그 페이지·태그 목록·책 상세는 # 를 붙이지 않고 아이콘을 쓴다', async () => {
    const tagPage = await read('../pages/tags/[slug].astro');
    expect(tagPage).not.toContain('`#${label}`');
    expect(tagPage).toContain('icon="tag"');
    const tagIndex = await read('../pages/tags/index.astro');
    expect(tagIndex).not.toContain('`#${group.label}`');
    expect(tagIndex).toContain('icon="tag"');
    const book = await read('../pages/books/[id].astro');
    expect(book).not.toContain('`#${tag}`');
    expect(book).toContain('tag-icon');
    const layout = await read('../layouts/ListLayout.astro');
    expect(layout).toContain('tag-icon');
    const index = await read('../components/TaxonomyIndex.astro');
    expect(index).toContain('tag-icon');
  });
});
