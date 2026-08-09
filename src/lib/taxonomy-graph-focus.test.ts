import { describe, expect, it } from 'vitest';
import type { TaxonomyGraphLayout } from './taxonomy-graph';
import { getRelatedGraphIds } from './taxonomy-graph-focus';

const graph = {
  edges: [
    { categorySlug: '개발', tagSlug: 'astro', weight: 2 },
    { categorySlug: '개발', tagSlug: 'typescript', weight: 1 },
    { categorySlug: '회고', tagSlug: 'typescript', weight: 1 },
  ],
} satisfies Pick<TaxonomyGraphLayout, 'edges'>;

describe('getRelatedGraphIds', () => {
  it('활성 카테고리와 직접 연결된 태그만 강조 대상으로 반환한다', () => {
    expect(getRelatedGraphIds(graph, 'category:개발')).toEqual(
      new Set(['category:개발', 'tag:astro', 'tag:typescript']),
    );
  });

  it('활성 노드가 없으면 강조 대상을 만들지 않는다', () => {
    expect(getRelatedGraphIds(graph, null)).toEqual(new Set());
  });
});
