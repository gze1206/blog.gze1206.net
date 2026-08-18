import { describe, expect, it } from 'vitest';
import { buildTaxonomyGraph } from './taxonomy-graph';
import { buildTaxonomyMap } from './taxonomy-map';
import {
  isEdgeVisible,
  queryFromSelectionId,
  selectionIdFromQuery,
  selectTaxonomyNode,
} from './taxonomy-map-selection';

function post(category: string, tags: string[]) {
  return { data: { category, tags } } as never;
}

const MAP = buildTaxonomyMap(
  buildTaxonomyGraph([
    post('Programming', ['csharp', 'perf']),
    post('Game', ['csharp', 'unity']),
    post('Tools', ['docker']),
  ]),
);

describe('selectTaxonomyNode', () => {
  it('기본은 전체 보기다', () => {
    const selection = selectTaxonomyNode(MAP, null);

    expect(selection.nodeId).toBeNull();
    expect(selection.visibleNodeIds.size).toBe(0);
  });

  it('모르는 노드를 고르면 전체 보기로 돌아간다', () => {
    expect(selectTaxonomyNode(MAP, 'tag:없는것').nodeId).toBeNull();
  });

  it('선택하면 1차와 2차 관계만 남는다', () => {
    const selection = selectTaxonomyNode(MAP, 'tag:csharp');

    // 1차: csharp 이 붙은 두 카테고리. 2차: 그 카테고리들이 품은 다른 태그.
    expect([...selection.directNodeIds].sort()).toEqual(['category:game', 'category:programming']);
    expect(selection.visibleNodeIds.has('tag:perf')).toBe(true);
    expect(selection.visibleNodeIds.has('tag:unity')).toBe(true);
    // 관계없는 가지는 빠진다.
    expect(selection.visibleNodeIds.has('category:tools')).toBe(false);
    expect(selection.visibleNodeIds.has('tag:docker')).toBe(false);
  });
});

describe('isEdgeVisible', () => {
  it('전체 보기에서는 태그끼리의 보조선을 그리지 않는다', () => {
    const selection = selectTaxonomyNode(MAP, null);
    const co = MAP.edges.find((edge) => edge.kind === 'co');
    const link = MAP.edges.find((edge) => edge.kind === 'link');

    expect(co && isEdgeVisible(co, selection)).toBe(false);
    expect(link && isEdgeVisible(link, selection)).toBe(true);
  });

  it('보조선은 선택한 노드에 닿을 때만 그린다', () => {
    const selection = selectTaxonomyNode(MAP, 'tag:csharp');
    const touching = MAP.edges.find(
      (edge) =>
        edge.kind === 'co' && (edge.sourceId === 'tag:csharp' || edge.targetId === 'tag:csharp'),
    );

    expect(touching && isEdgeVisible(touching, selection)).toBe(true);
  });

  it('선택 밖의 간선은 그리지 않는다', () => {
    const selection = selectTaxonomyNode(MAP, 'tag:csharp');
    const outside = MAP.edges.find(
      (edge) => edge.sourceId === 'category:tools' || edge.targetId === 'category:tools',
    );

    expect(outside && isEdgeVisible(outside, selection)).toBe(false);
  });
});

describe('URL 상태', () => {
  it('질의에서 선택을 복원한다', () => {
    expect(selectionIdFromQuery(new URLSearchParams('?category=programming'))).toBe(
      'category:programming',
    );
    expect(selectionIdFromQuery(new URLSearchParams('?tag=csharp'))).toBe('tag:csharp');
    expect(selectionIdFromQuery(new URLSearchParams(''))).toBeNull();
    expect(selectionIdFromQuery(new URLSearchParams('?tag='))).toBeNull();
  });

  it('전체 보기는 질의 없는 주소다', () => {
    expect(queryFromSelectionId(null)).toBe('');
    expect(queryFromSelectionId('category:programming')).toBe('?category=programming');
    expect(queryFromSelectionId('tag:c-sharp')).toBe('?tag=c-sharp');
  });

  it('한글 슬러그도 주소로 오갈 수 있다', () => {
    const query = queryFromSelectionId('tag:성능');

    expect(query).toBe(`?tag=${encodeURIComponent('성능')}`);
    expect(selectionIdFromQuery(new URLSearchParams(query))).toBe('tag:성능');
  });
});
