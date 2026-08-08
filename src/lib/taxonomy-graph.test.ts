import { describe, expect, it } from 'vitest';
import type { PostLike } from './posts';
import { buildTaxonomyGraph, layoutTaxonomyGraph } from './taxonomy-graph';

function post(slug: string, category: string, tags: string[], draft = false): PostLike {
  return {
    id: `${slug}.md`,
    data: {
      slug,
      category,
      tags,
      publishedAt: new Date('2026-08-09'),
      draft,
    },
  };
}

describe('buildTaxonomyGraph', () => {
  it('포스트의 카테고리와 고유 태그로 가중 이분 그래프를 만든다', () => {
    const graph = buildTaxonomyGraph([
      post('one', '개발', ['Astro', 'TypeScript', 'Astro']),
      post('two', '개발', ['Astro']),
      post('three', '회고', ['TypeScript']),
    ]);

    expect(graph.nodes).toEqual([
      { id: 'category:개발', kind: 'category', slug: '개발', label: '개발', count: 2 },
      { id: 'category:회고', kind: 'category', slug: '회고', label: '회고', count: 1 },
      { id: 'tag:astro', kind: 'tag', slug: 'astro', label: 'Astro', count: 2 },
      { id: 'tag:typescript', kind: 'tag', slug: 'typescript', label: 'TypeScript', count: 2 },
    ]);
    expect(graph.edges).toEqual([
      { categorySlug: '개발', tagSlug: 'astro', weight: 2 },
      { categorySlug: '개발', tagSlug: 'typescript', weight: 1 },
      { categorySlug: '회고', tagSlug: 'typescript', weight: 1 },
    ]);
  });

  it('입력 순서와 무관하게 한국어 label 순서로 정렬한다', () => {
    const forward = buildTaxonomyGraph([post('a', '회고', ['Zod']), post('b', '개발', ['Astro'])]);
    const backward = buildTaxonomyGraph([post('b', '개발', ['Astro']), post('a', '회고', ['Zod'])]);

    expect(forward).toEqual(backward);
    expect(forward.nodes.map((node) => node.label)).toEqual(['개발', '회고', 'Astro', 'Zod']);
  });
});

describe('layoutTaxonomyGraph', () => {
  it('카테고리와 태그를 양쪽 열에 결정적으로 배치한다', () => {
    const graph = buildTaxonomyGraph([
      post('one', '개발', ['Astro']),
      post('two', '회고', ['TypeScript']),
    ]);

    const first = layoutTaxonomyGraph(graph);
    const second = layoutTaxonomyGraph(graph);

    expect(first).toEqual(second);
    expect(first.width).toBeGreaterThan(0);
    expect(first.height).toBeGreaterThan(0);
    expect(
      first.nodes.filter((node) => node.kind === 'category').every((node) => node.x === 80),
    ).toBe(true);
    expect(
      first.nodes
        .filter((node) => node.kind === 'tag')
        .every((node) => node.x === first.width - 80),
    ).toBe(true);
    expect(first.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(
      true,
    );
  });
});
