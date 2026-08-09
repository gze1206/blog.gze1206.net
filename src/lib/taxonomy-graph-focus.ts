import type { TaxonomyGraphLayout } from './taxonomy-graph';

/** 활성 노드와 직접 연결된 노드만 관계 강조 대상으로 선택한다. */
export function getRelatedGraphIds(
  graph: Pick<TaxonomyGraphLayout, 'edges'>,
  activeNodeId: string | null,
): ReadonlySet<string> {
  if (activeNodeId === null) return new Set();

  const related = new Set([activeNodeId]);

  for (const edge of graph.edges) {
    const categoryId = `category:${edge.categorySlug}`;
    const tagId = `tag:${edge.tagSlug}`;

    if (activeNodeId === categoryId) related.add(tagId);
    if (activeNodeId === tagId) related.add(categoryId);
  }

  return related;
}
