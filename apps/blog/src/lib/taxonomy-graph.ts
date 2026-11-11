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

/** 같은 글에서 함께 쓰인 태그 쌍. `a` 가 항상 사전순으로 앞이라 같은 쌍이 두 번 생기지 않는다. */
export interface TaxonomyCoOccurrence {
  readonly aSlug: string;
  readonly bSlug: string;
  readonly weight: number;
}

export interface TaxonomyGraph {
  readonly nodes: readonly TaxonomyGraphNode[];
  readonly edges: readonly TaxonomyGraphEdge[];
  /**
   * 태그끼리의 보조 관계. 카테고리–태그 간선과 달리 **기본 화면에서는 그리지 않는다** —
   * 다 그리면 지도가 실뭉치가 된다. 선택한 노드 주변에서만 드러낸다(NOR-152).
   */
  readonly coOccurrences: readonly TaxonomyCoOccurrence[];
}

interface TaxonomyCounter {
  readonly slug: string;
  readonly label: string;
  count: number;
}

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
  const coWeights = new Map<string, number>();

  for (const post of posts) {
    const category = addCounter(categories, post.data.category);
    const uniqueTags = new Set(post.data.tags);
    const postTagSlugs: string[] = [];

    for (const tagLabel of uniqueTags) {
      const tag = addCounter(tags, tagLabel);
      postTagSlugs.push(tag.slug);
      const edgeId = `${category.slug}\u0000${tag.slug}`;
      edgeWeights.set(edgeId, (edgeWeights.get(edgeId) ?? 0) + 1);
    }

    // 한 글 안에서 만난 태그 쌍을 센다. 정렬해서 넣으므로 (a,b)와 (b,a)가 갈라지지 않는다.
    const sortedTagSlugs = [...new Set(postTagSlugs)].sort();
    for (let i = 0; i < sortedTagSlugs.length; i += 1) {
      for (let j = i + 1; j < sortedTagSlugs.length; j += 1) {
        const pairId = `${sortedTagSlugs[i]}\u0000${sortedTagSlugs[j]}`;
        coWeights.set(pairId, (coWeights.get(pairId) ?? 0) + 1);
      }
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

  const coOccurrences = [...coWeights.entries()]
    .map(([id, weight]) => {
      const [aSlug, bSlug] = id.split('\u0000');
      return { aSlug: aSlug ?? '', bSlug: bSlug ?? '', weight };
    })
    .sort((left, right) => {
      if (left.weight !== right.weight) return right.weight - left.weight;
      const aOrder = left.aSlug.localeCompare(right.aSlug, 'ko');
      return aOrder !== 0 ? aOrder : left.bSlug.localeCompare(right.bSlug, 'ko');
    });

  return { nodes: [...categoryNodes, ...tagNodes], edges, coOccurrences };
}
