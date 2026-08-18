/**
 * 분류 지도의 좌표 계산 (NOR-152).
 *
 * ### 왜 빌드타임에 고정하는가
 *
 * 배치를 브라우저에서 계산하면 같은 글 목록인데도 방문할 때마다 지도가 달라진다. 그러면
 * "저번에 저기 있던 태그"라는 기억이 무의미해지고, 링크로 공유한 화면도 재현되지 않는다.
 * 그래서 여기서 한 번 계산하고, 화면은 그 좌표를 **그리기만** 한다.
 *
 * ### 배치의 의미
 *
 * - 카테고리는 중심을 둘러싼 큰 닻이다. 개수가 적고 잘 변하지 않으므로 원형으로 고정한다.
 * - 태그는 자신이 붙은 카테고리들의 **가중 평균 방향**에 놓인다. 두 카테고리에 걸친 태그는
 *   자연히 그 사이에 앉는다 — 이것이 "지도"가 관계를 말하는 방식이다.
 * - 글이 많은 태그일수록 중심에 가깝다. 주변부일수록 드물게 다룬 주제다.
 *
 * 좌표와 반지름은 **하나의 출처**에서 나온다. 노드와 간선이 각자 계산하면 화면에서 어긋난다.
 */
import type { TaxonomyGraph, TaxonomyGraphNode, TaxonomyKind } from './taxonomy-graph';

export interface TaxonomyMapNode extends TaxonomyGraphNode {
  readonly x: number;
  readonly y: number;
  /** 노드 반지름. 카테고리는 고정, 태그는 글 수에 따라 커진다. */
  readonly radius: number;
}

export interface TaxonomyMapEdge {
  readonly sourceId: string;
  readonly targetId: string;
  readonly weight: number;
  /** `co` 는 태그끼리의 보조 관계다. 기본 화면에서는 그리지 않는다. */
  readonly kind: 'link' | 'co';
}

export interface TaxonomyMap {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly TaxonomyMapNode[];
  readonly edges: readonly TaxonomyMapEdge[];
  /** 간선 굵기를 정규화할 때 쓰는 최대 가중치. 0 이면 간선이 없다는 뜻이다. */
  readonly maxWeight: number;
}

const WIDTH = 900;
const HEIGHT = 560;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
/** 세로가 가로보다 짧으므로 원을 그대로 쓰면 위아래가 잘린다. */
const VERTICAL_SQUEEZE = 0.74;
const CATEGORY_RING = 165;
const TAG_RING_NEAR = 215;
const TAG_RING_FAR = 335;
const CATEGORY_RADIUS = 27;
const TAG_RADIUS_MIN = 9;
const TAG_RADIUS_MAX = 20;
const PADDING = 28;
/** 겹침을 푸는 반복 횟수. 노드가 수십 개 규모라 이 정도면 충분히 안정된다. */
const RELAX_ITERATIONS = 90;
const RELAX_STEP = 0.5;
/** 이름표가 노드 아래에 놓이므로 세로로 그만큼 더 자리를 잡아 준다. */
const LABEL_BAND = 15;
/** 같은 방향을 가진 태그들을 펼치는 각도(라디안). */
const FAN_PER_NODE = 0.13;
const FAN_MAX = 1.5;

interface MutablePoint {
  readonly id: string;
  readonly kind: TaxonomyKind;
  readonly radius: number;
  /** 카테고리는 닻이라 밀리지 않는다. */
  readonly fixed: boolean;
  /** 이름표까지 포함한 자리의 반너비·반높이. 원만 떼어 놓으면 글자가 겹친다. */
  readonly halfWidth: number;
  readonly halfHeight: number;
  x: number;
  y: number;
}

/**
 * 이름표의 대략적인 너비(px).
 *
 * 정확한 글자 폭은 폰트가 로드돼야 알 수 있고, 그것은 빌드타임에 없다. 한글은 대체로
 * 전각이라 라틴 문자의 두 배로 잡는다. 조금 넉넉히 잡아 겹치는 쪽보다 벌어지는 쪽으로 튄다.
 */
function estimateLabelWidth(label: string, fontSize: number): number {
  let units = 0;
  for (const character of label) {
    units += /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u3040-\u30ff\u4e00-\u9fff]/.test(character)
      ? 1
      : 0.55;
  }
  return units * fontSize;
}

function angleAt(index: number, count: number): number {
  // 12시 방향부터 시계 방향으로 고르게 돌린다.
  return -Math.PI / 2 + (2 * Math.PI * index) / Math.max(count, 1);
}

function scale(value: number, min: number, max: number, from: number, to: number): number {
  if (max <= min) return (from + to) / 2;
  return from + ((value - min) / (max - min)) * (to - from);
}

/**
 * 그래프에 좌표를 입힌다. 같은 입력은 항상 같은 좌표를 낸다 — 난수도, 시각도 쓰지 않는다.
 */
export function buildTaxonomyMap(graph: TaxonomyGraph): TaxonomyMap {
  const categories = graph.nodes.filter((node) => node.kind === 'category');
  const tags = graph.nodes.filter((node) => node.kind === 'tag');

  const categoryAngles = new Map<string, number>();
  const points = new Map<string, MutablePoint>();

  categories.forEach((node, index) => {
    const angle = angleAt(index, categories.length);
    categoryAngles.set(node.slug, angle);
    points.set(node.id, {
      id: node.id,
      kind: 'category',
      radius: CATEGORY_RADIUS,
      fixed: true,
      halfWidth: Math.max(CATEGORY_RADIUS, estimateLabelWidth(node.label, 12) / 2),
      halfHeight: CATEGORY_RADIUS + LABEL_BAND,
      x: CENTER_X + Math.cos(angle) * CATEGORY_RING,
      y: CENTER_Y + Math.sin(angle) * CATEGORY_RING * VERTICAL_SQUEEZE,
    });
  });

  // 태그의 기본 방향: 붙어 있는 카테고리 방향의 가중 평균. 각도를 그냥 평균하면 0/2π
  // 경계에서 무너지므로 단위 벡터를 더한 뒤 방향을 되찾는다.
  const baseAngles = tags.map((tag, index) => {
    let vectorX = 0;
    let vectorY = 0;
    for (const edge of graph.edges) {
      if (edge.tagSlug !== tag.slug) continue;
      const angle = categoryAngles.get(edge.categorySlug);
      if (angle === undefined) continue;
      vectorX += Math.cos(angle) * edge.weight;
      vectorY += Math.sin(angle) * edge.weight;
    }
    return vectorX === 0 && vectorY === 0
      ? angleAt(index, tags.length)
      : Math.atan2(vectorY, vectorX);
  });

  // 한 카테고리에만 붙은 태그들은 방향이 전부 같아 한 점에 쌓인다. 같은 방향을 가진 것들을
  // 부채꼴로 펼쳐 두면 이후의 겹침 풀기가 훨씬 적게 움직여도 된다.
  const byAngle = new Map<string, number[]>();
  baseAngles.forEach((angle, index) => {
    const key = angle.toFixed(4);
    const bucket = byAngle.get(key);
    if (bucket === undefined) byAngle.set(key, [index]);
    else bucket.push(index);
  });

  const tagCounts = tags.map((tag) => tag.count);
  const minCount = tagCounts.length > 0 ? Math.min(...tagCounts) : 0;
  const maxCount = tagCounts.length > 0 ? Math.max(...tagCounts) : 0;

  for (const indices of byAngle.values()) {
    const spread = Math.min(FAN_MAX, FAN_PER_NODE * (indices.length - 1));
    indices.forEach((tagIndex, position) => {
      const tag = tags[tagIndex];
      const baseAngle = baseAngles[tagIndex];
      if (tag === undefined || baseAngle === undefined) return;

      const offset = indices.length === 1 ? 0 : (position / (indices.length - 1) - 0.5) * spread;
      const angle = baseAngle + offset;
      // 많이 쓴 태그일수록 중심 가까이. 주변부는 드물게 다룬 주제라는 뜻이 된다.
      const ring = scale(tag.count, minCount, maxCount, TAG_RING_FAR, TAG_RING_NEAR);
      const radius = scale(tag.count, minCount, maxCount, TAG_RADIUS_MIN, TAG_RADIUS_MAX);

      points.set(tag.id, {
        id: tag.id,
        kind: 'tag',
        radius,
        fixed: false,
        halfWidth: Math.max(radius, estimateLabelWidth(tag.label, 11) / 2),
        halfHeight: radius + LABEL_BAND,
        x: CENTER_X + Math.cos(angle) * ring,
        y: CENTER_Y + Math.sin(angle) * ring * VERTICAL_SQUEEZE,
      });
    });
  }

  relax([...points.values()]);

  const nodes = graph.nodes.map((node) => {
    const point = points.get(node.id);
    return {
      ...node,
      x: Math.round((point?.x ?? CENTER_X) * 100) / 100,
      y: Math.round((point?.y ?? CENTER_Y) * 100) / 100,
      radius: point?.radius ?? TAG_RADIUS_MIN,
    };
  });

  const edges: TaxonomyMapEdge[] = [
    ...graph.edges.map((edge) => ({
      sourceId: `category:${edge.categorySlug}`,
      targetId: `tag:${edge.tagSlug}`,
      weight: edge.weight,
      kind: 'link' as const,
    })),
    ...graph.coOccurrences.map((pair) => ({
      sourceId: `tag:${pair.aSlug}`,
      targetId: `tag:${pair.bSlug}`,
      weight: pair.weight,
      kind: 'co' as const,
    })),
  ];

  const maxWeight = graph.edges.reduce((max, edge) => Math.max(max, edge.weight), 0);

  return { width: WIDTH, height: HEIGHT, nodes, edges, maxWeight };
}

/**
 * 겹친 노드를 서로 밀어내고 화면 안으로 되돌린다. 카테고리는 움직이지 않는다.
 *
 * 원이 아니라 **이름표까지 포함한 상자**로 판정한다. 원만 떼어 놓으면 지름은 작고 이름은 긴
 * 태그들이 서로의 글자 위에 앉는다. 겹침이 적은 축으로만 밀어 배치의 뜻(방향)을 덜 흐트러뜨린다.
 */
function relax(points: readonly MutablePoint[]): void {
  for (let iteration = 0; iteration < RELAX_ITERATIONS; iteration += 1) {
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];
        if (a === undefined || b === undefined) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = a.halfWidth + b.halfWidth + 6 - Math.abs(dx);
        const overlapY = a.halfHeight + b.halfHeight + 4 - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        // 완전히 겹쳐 방향이 없으면 결정적인 방향으로 가른다.
        if (overlapX < overlapY) {
          const direction = dx === 0 ? 1 : Math.sign(dx);
          const push = overlapX * RELAX_STEP * direction;
          if (!a.fixed) a.x -= push;
          if (!b.fixed) b.x += push;
        } else {
          const direction = dy === 0 ? 1 : Math.sign(dy);
          const push = overlapY * RELAX_STEP * direction;
          if (!a.fixed) a.y -= push;
          if (!b.fixed) b.y += push;
        }
      }
    }

    for (const point of points) {
      if (point.fixed) continue;
      point.x = Math.min(
        WIDTH - PADDING - point.halfWidth,
        Math.max(PADDING + point.halfWidth, point.x),
      );
      point.y = Math.min(
        HEIGHT - PADDING - point.halfHeight,
        Math.max(PADDING + point.radius, point.y),
      );
    }
  }
}
