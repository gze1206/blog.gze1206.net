import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('/topics 정적 탐색과 분류 맵 계약', () => {
  const pageSource = readSource('src/pages/topics.astro');
  const graphSource = readSource('src/islands/TaxonomyGraph.tsx');

  it('정적 탐색기를 분류 맵보다 먼저 제공한다', () => {
    expect(pageSource).toContain('분류 맵');
    expect(pageSource.indexOf('<TaxonomyExplorer')).toBeLessThan(
      pageSource.indexOf('<TaxonomyGraph'),
    );
  });

  it('그래프의 노드 유형과 SVG 대체 텍스트를 명시한다', () => {
    expect(graphSource).toContain('taxonomy-graph-legend');
    expect(graphSource).toContain('<span>카테고리</span>');
    expect(graphSource).toContain('<span>태그</span>');
    expect(graphSource).toContain('<title id="topics-graph-title">');
    expect(graphSource).toContain('<desc id="topics-graph-description">');
  });

  it('SVG 내부 링크의 접근 가능한 이름을 평탄화하지 않는다', () => {
    expect(graphSource).not.toContain('role="img"');
    expect(graphSource).toContain('aria-labelledby="topics-graph-title topics-graph-description"');
  });

  it('SVG 노드를 분류 결과의 앵커 링크로 만든다', () => {
    expect(graphSource).toContain(
      "const href = node.kind === 'category' ? categoryPath(node.slug) : tagPath(node.slug);",
    );
    expect(graphSource).toContain('href={href}');
  });

  it('투명 hit area를 보이는 노드 원과 분리한다', () => {
    const stylesSource = readSource('src/styles/global.css');

    expect(stylesSource).toContain(
      '.taxonomy-graph-node circle:not(.taxonomy-graph-node-hit-area)',
    );
  });
});
