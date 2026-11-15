import { describe, expect, it } from 'vitest';
import { buildTaxonomyGraph } from './taxonomy-graph';
import { buildTaxonomyMap, edgePath, mapLabel } from './taxonomy-map';

function post(category: string, tags: string[]) {
  return { data: { category, tags } } as never;
}

const POSTS = [
  post('Programming', ['C#', '성능']),
  post('Programming', ['C#', '설계']),
  post('Game', ['C#', 'Unity']),
  post('Tools', ['Docker']),
];

describe('buildTaxonomyMap', () => {
  it('같은 입력은 항상 같은 좌표를 낸다', () => {
    const graph = buildTaxonomyGraph(POSTS);

    expect(buildTaxonomyMap(graph)).toEqual(buildTaxonomyMap(graph));
  });

  it('모든 노드가 화면 안에 있다', () => {
    const map = buildTaxonomyMap(buildTaxonomyGraph(POSTS));

    for (const node of map.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(node.radius);
      expect(node.x).toBeLessThanOrEqual(map.width - node.radius);
      expect(node.y).toBeGreaterThanOrEqual(node.radius);
      expect(node.y).toBeLessThanOrEqual(map.height - node.radius);
    }
  });

  it('노드도 이름표도 서로 겹치지 않는다', () => {
    // 이름은 노드 아래에 놓이므로, 원만 떨어져 있어도 글자가 겹칠 수 있다.
    const map = buildTaxonomyMap(buildTaxonomyGraph(POSTS));

    for (let i = 0; i < map.nodes.length; i += 1) {
      for (let j = i + 1; j < map.nodes.length; j += 1) {
        const a = map.nodes[i];
        const b = map.nodes[j];
        if (a === undefined || b === undefined) continue;
        const apart =
          Math.abs(b.x - a.x) > a.radius + b.radius || Math.abs(b.y - a.y) > a.radius + b.radius;

        expect(apart).toBe(true);
      }
    }
  });

  it('한 카테고리에만 붙은 태그들이 한 점에 쌓이지 않는다', () => {
    const map = buildTaxonomyMap(buildTaxonomyGraph([post('Tools', ['a', 'b', 'c', 'd', 'e'])]));
    const tags = map.nodes.filter((node) => node.kind === 'tag');
    const positions = new Set(tags.map((tag) => `${tag.x},${tag.y}`));

    expect(positions.size).toBe(tags.length);
  });

  it('글이 많은 태그가 더 크게 그려진다', () => {
    const map = buildTaxonomyMap(buildTaxonomyGraph(POSTS));
    const csharp = map.nodes.find((node) => node.label === 'C#');
    const docker = map.nodes.find((node) => node.label === 'Docker');

    expect(csharp?.count ?? 0).toBeGreaterThan(docker?.count ?? 0);
    expect(csharp?.radius ?? 0).toBeGreaterThan(docker?.radius ?? 0);
  });

  it('간선은 노드 id 로만 연결되고 태그끼리의 관계는 보조로 표시된다', () => {
    const map = buildTaxonomyMap(buildTaxonomyGraph(POSTS));
    const ids = new Set(map.nodes.map((node) => node.id));

    for (const edge of map.edges) {
      expect(ids.has(edge.sourceId)).toBe(true);
      expect(ids.has(edge.targetId)).toBe(true);
    }

    const co = map.edges.filter((edge) => edge.kind === 'co');
    expect(co.length).toBeGreaterThan(0);
    for (const edge of co) {
      expect(edge.sourceId.startsWith('tag:')).toBe(true);
      expect(edge.targetId.startsWith('tag:')).toBe(true);
    }
  });

  it('분류가 하나도 없어도 무너지지 않는다', () => {
    const map = buildTaxonomyMap(buildTaxonomyGraph([]));

    expect(map.nodes).toEqual([]);
    expect(map.edges).toEqual([]);
    expect(map.maxWeight).toBe(0);
  });
});

describe('edgePath', () => {
  const center = { x: 450, y: 280 };

  it('시작점과 끝점은 노드 중심 그대로다', () => {
    const path = edgePath({ x: 100, y: 100 }, { x: 300, y: 200 }, center);

    expect(path.startsWith('M100 100')).toBe(true);
    expect(path.endsWith('300 200')).toBe(true);
  });

  it('곡률이 0 이면 직선이다', () => {
    expect(edgePath({ x: 0, y: 0 }, { x: 10, y: 0 }, center, 0)).toBe('M0 0L10 0');
  });

  it('길이가 0 이면 곡선을 만들지 않는다', () => {
    expect(edgePath({ x: 5, y: 5 }, { x: 5, y: 5 }, center)).toBe('M5 5L5 5');
  });

  it('제어점은 지도 중심에서 멀어지는 쪽에 놓인다', () => {
    // 중심 위쪽을 지나는 수평선이면 제어점도 중심보다 위(y 가 더 작은 쪽)에 있어야 한다.
    const path = edgePath({ x: 350, y: 100 }, { x: 550, y: 100 }, center);
    const control = path.match(/Q(-?[\d.]+) (-?[\d.]+)/);

    expect(control).not.toBeNull();
    expect(Number(control?.[2])).toBeLessThan(100);
  });

  it('같은 입력은 같은 경로를 낸다', () => {
    const a = edgePath({ x: 12, y: 34 }, { x: 56, y: 78 }, center);
    const b = edgePath({ x: 12, y: 34 }, { x: 56, y: 78 }, center);

    expect(a).toBe(b);
  });
});

describe('mapLabel', () => {
  it('짧은 이름은 그대로 둔다', () => {
    expect(mapLabel('C#')).toBe('C#');
    expect(mapLabel('성능 최적화')).toBe('성능 최적화');
  });

  it('긴 이름은 줄이고 말줄임을 붙인다', () => {
    expect(mapLabel('content collections')).toBe('content co…');
    expect(mapLabel('content collections').length).toBeLessThanOrEqual(11);
  });
});
