import { describe, expect, it } from 'vitest';
import { buildTaxonomyGraph } from './taxonomy-graph';
import { buildTaxonomyMap } from './taxonomy-map';

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
