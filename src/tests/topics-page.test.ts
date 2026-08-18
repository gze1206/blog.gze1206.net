import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('/topics 탐색 계약 (NOR-152)', () => {
  const pageSource = readSource('src/pages/topics.astro');
  const mapSource = readSource('src/islands/TaxonomyMap.tsx');

  it('지도 없이도 갈 수 있도록 정적 목록을 지도 앞뒤에 둔다', () => {
    const categories = pageSource.indexOf('<TaxonomyCategoryList');
    const map = pageSource.indexOf('<TaxonomyMap');
    const tags = pageSource.indexOf('<TaxonomyTagList');

    expect(categories).toBeGreaterThan(-1);
    expect(categories).toBeLessThan(map);
    expect(map).toBeLessThan(tags);
  });

  it('선택 이후의 행동(글 목록)을 서버에서 만들어 넘긴다', () => {
    expect(pageSource).toContain('details[`category:${group.slug}`]');
    expect(pageSource).toContain('details[`tag:${group.slug}`]');
    expect(pageSource).toContain('postPath(post.data.slug)');
  });

  it('좌표는 빌드타임에 고정한다', () => {
    expect(pageSource).toContain('buildTaxonomyMap(buildTaxonomyGraph(posts))');
    expect(mapSource).not.toContain('Math.random');
  });

  it('노드는 실제 링크이고, 새 탭으로 여는 조작은 브라우저에 맡긴다', () => {
    expect(mapSource).toContain('href={nodeDetail?.href');
    expect(mapSource).toContain('event.metaKey || event.ctrlKey || event.shiftKey');
  });

  it('전체 보기로 돌아가는 길을 항상 제공한다', () => {
    expect(mapSource).toContain('선택 해제');
    expect(mapSource).toContain('select(null)');
  });

  it('노드와 간선이 같은 좌표 배열을 쓴다', () => {
    // 간선은 노드 좌표를 조회해서 긋는다. 각자 계산하면 선 끝이 노드에서 어긋난다.
    expect(mapSource).toContain('nodePositions.get(edge.sourceId)');
    expect(mapSource).toContain('nodePositions.get(edge.targetId)');
  });
});
