/**
 * 분류 지도의 선택 상태 (NOR-152).
 *
 * 지도는 두 가지 상태만 갖는다.
 *
 * - **전체**(선택 없음): 모든 카테고리–태그 관계를 그린다. 기본값이다 — 지도를 처음 볼 때
 *   해야 할 일은 "전체를 보는 것"이지 "하나를 고르는 것"이 아니다.
 * - **선택**: 고른 항목의 1차(직접 연결)와 2차(연결의 연결)만 남긴다. 2차까지 남기는 것은
 *   "이 태그가 어떤 카테고리에 걸쳐 있고, 그 카테고리가 또 무엇을 품는가"가 한 화면에
 *   보여야 탐색이 이어지기 때문이다.
 *
 * 태그끼리의 보조선은 선택 상태에서만, 그것도 선택 이웃 안에서만 그린다.
 */
import type { TaxonomyMap, TaxonomyMapEdge } from './taxonomy-map';

export interface TaxonomySelection {
  /** 선택한 노드 id. `null` 이면 전체 보기다. */
  readonly nodeId: string | null;
  /** 흐리게 처리하지 않을 노드. 전체 보기에서는 비어 있다(= 모두 또렷하다). */
  readonly visibleNodeIds: ReadonlySet<string>;
  /** 1차 이웃. 지표("직접 연결 N개")에 쓴다. */
  readonly directNodeIds: ReadonlySet<string>;
}

/** 선택 상태에서 이 간선을 그릴지. */
export function isEdgeVisible(edge: TaxonomyMapEdge, selection: TaxonomySelection): boolean {
  if (selection.nodeId === null) return edge.kind === 'link';

  const bothVisible =
    selection.visibleNodeIds.has(edge.sourceId) && selection.visibleNodeIds.has(edge.targetId);
  if (!bothVisible) return false;

  // 보조선은 선택한 노드에 실제로 닿는 것만 남긴다. 이웃끼리의 보조선까지 그리면
  // 좁혀 놓은 화면이 다시 실뭉치가 된다.
  if (edge.kind === 'co') {
    return edge.sourceId === selection.nodeId || edge.targetId === selection.nodeId;
  }

  return true;
}

/** 지도와 선택한 노드 id 로 선택 상태를 만든다. `null` 이면 전체 보기다. */
export function selectTaxonomyNode(
  map: Pick<TaxonomyMap, 'nodes' | 'edges'>,
  nodeId: string | null,
): TaxonomySelection {
  const exists = nodeId !== null && map.nodes.some((node) => node.id === nodeId);
  if (!exists) {
    return { nodeId: null, visibleNodeIds: new Set(), directNodeIds: new Set() };
  }

  const neighbours = new Map<string, Set<string>>();
  for (const edge of map.edges) {
    // 보조선(태그–태그)은 이웃 관계를 넓히지 않는다. 그것까지 세면 두 다리 건너 전부가 남는다.
    if (edge.kind !== 'link') continue;
    if (!neighbours.has(edge.sourceId)) neighbours.set(edge.sourceId, new Set());
    if (!neighbours.has(edge.targetId)) neighbours.set(edge.targetId, new Set());
    neighbours.get(edge.sourceId)?.add(edge.targetId);
    neighbours.get(edge.targetId)?.add(edge.sourceId);
  }

  const direct = new Set(neighbours.get(nodeId) ?? []);
  const visible = new Set<string>([nodeId, ...direct]);
  for (const id of direct) {
    for (const second of neighbours.get(id) ?? []) visible.add(second);
  }

  return { nodeId, visibleNodeIds: visible, directNodeIds: direct };
}

/** URL 질의로 선택을 복원한다. 없거나 모르는 값이면 전체 보기다. */
export function selectionIdFromQuery(query: URLSearchParams): string | null {
  const category = query.get('category');
  if (category !== null && category !== '') return `category:${category}`;

  const tag = query.get('tag');
  if (tag !== null && tag !== '') return `tag:${tag}`;

  return null;
}

/** 선택을 URL 질의로 되돌린다. 전체 보기는 질의 없는 주소다 — 공유했을 때 같은 화면이 뜬다. */
export function queryFromSelectionId(nodeId: string | null): string {
  if (nodeId === null) return '';

  const [kind, ...rest] = nodeId.split(':');
  const slug = rest.join(':');
  if (slug === '') return '';
  if (kind === 'category') return `?category=${encodeURIComponent(slug)}`;
  if (kind === 'tag') return `?tag=${encodeURIComponent(slug)}`;
  return '';
}
