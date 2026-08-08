import type { PostLike } from './posts';
import { toSlug } from './slug';

export type TaxonomyKind = 'category' | 'tag';

export interface TaxonomyGraphNode {
  readonly id: string;
  readonly kind: TaxonomyKind;
  readonly slug: string;
  readonly label: string;
  readonly count: number;
}

export interface TaxonomyGraphEdge {
  readonly categorySlug: string;
  readonly tagSlug: string;
  readonly weight: number;
}

export interface TaxonomyGraph {
  readonly nodes: readonly TaxonomyGraphNode[];
  readonly edges: readonly TaxonomyGraphEdge[];
}

export interface TaxonomyGraphLayoutNode extends TaxonomyGraphNode {
  readonly x: number;
  readonly y: number;
}

export interface TaxonomyGraphLayout extends TaxonomyGraph {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly TaxonomyGraphLayoutNode[];
}

interface TaxonomyCounter {
  readonly slug: string;
  readonly label: string;
  count: number;
}

const NODE_MARGIN_X = 80;
const NODE_MARGIN_Y = 48;
const NODE_GAP_Y = 40;
const MIN_GRAPH_HEIGHT = 160;
const GRAPH_WIDTH = 880;

function compareLabels(left: { label: string }, right: { label: string }): number {
  return left.label.localeCompare(right.label, 'ko');
}

function addCounter(counters: Map<string, TaxonomyCounter>, label: string): TaxonomyCounter {
  const slug = toSlug(label);
  const existing = counters.get(slug);
  if (existing !== undefined) {
    existing.count += 1;
    return existing;
  }

  const created = { slug, label, count: 1 };
  counters.set(slug, created);
  return created;
}

/**
 * 노출 대상 포스트에서 카테고리 ↔ 태그의 가중 이분 그래프를 파생한다.
 *
 * 호출 전 `getVisiblePosts()`가 스키마·분류 슬러그 충돌을 검사한다. 이 모듈은 화면과 독립적인
 * DTO만 만들며 입력의 순서나 태그 중복이 결과에 영향을 주지 않게 한다.
 */
export function buildTaxonomyGraph(posts: readonly PostLike[]): TaxonomyGraph {
  const categories = new Map<string, TaxonomyCounter>();
  const tags = new Map<string, TaxonomyCounter>();
  const edgeWeights = new Map<string, number>();

  for (const post of posts) {
    const category = addCounter(categories, post.data.category);
    const uniqueTags = new Set(post.data.tags);

    for (const tagLabel of uniqueTags) {
      const tag = addCounter(tags, tagLabel);
      const edgeId = `${category.slug}\u0000${tag.slug}`;
      edgeWeights.set(edgeId, (edgeWeights.get(edgeId) ?? 0) + 1);
    }
  }

  const categoryNodes = [...categories.values()]
    .sort(compareLabels)
    .map(({ slug, label, count }) => ({
      id: `category:${slug}`,
      kind: 'category' as const,
      slug,
      label,
      count,
    }));
  const tagNodes = [...tags.values()].sort(compareLabels).map(({ slug, label, count }) => ({
    id: `tag:${slug}`,
    kind: 'tag' as const,
    slug,
    label,
    count,
  }));
  const categoryLabels = new Map(categoryNodes.map((node) => [node.slug, node.label]));
  const tagLabels = new Map(tagNodes.map((node) => [node.slug, node.label]));

  const edges = [...edgeWeights.entries()]
    .map(([id, weight]) => {
      const [categorySlug, tagSlug] = id.split('\u0000');
      return { categorySlug: categorySlug ?? '', tagSlug: tagSlug ?? '', weight };
    })
    .sort((left, right) => {
      const categoryOrder = (categoryLabels.get(left.categorySlug) ?? '').localeCompare(
        categoryLabels.get(right.categorySlug) ?? '',
        'ko',
      );
      if (categoryOrder !== 0) return categoryOrder;
      return (tagLabels.get(left.tagSlug) ?? '').localeCompare(
        tagLabels.get(right.tagSlug) ?? '',
        'ko',
      );
    });

  return { nodes: [...categoryNodes, ...tagNodes], edges };
}

/** SVG가 추가 상태 없이 같은 좌표를 재현할 수 있도록 두 열로 배치한다. */
export function layoutTaxonomyGraph(graph: TaxonomyGraph): TaxonomyGraphLayout {
  const categories = graph.nodes.filter((node) => node.kind === 'category');
  const tags = graph.nodes.filter((node) => node.kind === 'tag');
  const rowCount = Math.max(categories.length, tags.length, 1);
  const height = Math.max(MIN_GRAPH_HEIGHT, NODE_MARGIN_Y * 2 + (rowCount - 1) * NODE_GAP_Y);
  const yAt = (index: number, count: number): number => {
    if (count <= 1) return height / 2;
    return NODE_MARGIN_Y + (index * (height - NODE_MARGIN_Y * 2)) / (count - 1);
  };

  const nodes = [
    ...categories.map((node, index) => ({
      ...node,
      x: NODE_MARGIN_X,
      y: yAt(index, categories.length),
    })),
    ...tags.map((node, index) => ({
      ...node,
      x: GRAPH_WIDTH - NODE_MARGIN_X,
      y: yAt(index, tags.length),
    })),
  ];

  return { ...graph, width: GRAPH_WIDTH, height, nodes };
}
