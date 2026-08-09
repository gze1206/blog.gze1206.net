import { useEffect, useState } from 'react';
import type { TaxonomyGraphLayout } from '../lib/taxonomy-graph';
import { getRelatedGraphIds } from '../lib/taxonomy-graph-focus';
import { categoryPath, tagPath } from '../lib/routes';

interface Props {
  readonly graph: TaxonomyGraphLayout;
}

/**
 * 분류 간 연결을 빠르게 훑는 보조 시각화다. 모든 목적지는 정적 탐색 목록에도 있으므로,
 * JavaScript를 쓰지 않거나 모션을 줄인 환경에서는 이 아일랜드를 표시하지 않는다.
 */
export default function TaxonomyGraph({ graph }: Props) {
  const [shouldRender, setShouldRender] = useState(false);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setShouldRender(!media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  if (!shouldRender) return null;

  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const activeNodeId = focusedNodeId ?? hoveredNodeId;
  const relatedGraphIds = getRelatedGraphIds(graph, activeNodeId);

  return (
    <section aria-labelledby="topics-graph-heading" className="taxonomy-graph-section mt-12">
      <h2 id="topics-graph-heading" className="text-2xl font-bold tracking-tight">
        카테고리와 태그의 연결
      </h2>
      <p className="text-muted mt-2">선이 진할수록 해당 조합을 다룬 글이 많습니다.</p>
      <div className="taxonomy-graph-scroll border-border bg-surface mt-5 rounded-lg border p-3">
        <svg
          role="img"
          aria-labelledby="topics-graph-title topics-graph-description"
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          width={graph.width}
          height={graph.height}
          className="taxonomy-graph"
        >
          <title id="topics-graph-title">카테고리와 태그 관계 그래프</title>
          <desc id="topics-graph-description">
            왼쪽의 카테고리와 오른쪽의 태그를 연결해, 각 글의 분류 관계를 보여 줍니다.
          </desc>
          {graph.edges.map((edge) => {
            const category = nodes.get(`category:${edge.categorySlug}`);
            const tag = nodes.get(`tag:${edge.tagSlug}`);
            if (category === undefined || tag === undefined) return null;
            const isRelated =
              activeNodeId !== null &&
              relatedGraphIds.has(category.id) &&
              relatedGraphIds.has(tag.id);

            return (
              <line
                key={`${edge.categorySlug}:${edge.tagSlug}`}
                x1={category.x}
                y1={category.y}
                x2={tag.x}
                y2={tag.y}
                className={isRelated ? 'taxonomy-graph-edge is-related' : 'taxonomy-graph-edge'}
                strokeWidth={1 + edge.weight}
              />
            );
          })}
          {graph.nodes.map((node) => {
            const href = node.kind === 'category' ? categoryPath(node.slug) : tagPath(node.slug);
            const anchor = node.kind === 'category' ? 'end' : 'start';
            const labelX = node.kind === 'category' ? node.x - 12 : node.x + 12;
            const isRelated = activeNodeId !== null && relatedGraphIds.has(node.id);

            return (
              <a
                key={node.id}
                href={href}
                className={isRelated ? 'taxonomy-graph-node is-related' : 'taxonomy-graph-node'}
                onFocus={() => setFocusedNodeId(node.id)}
                onBlur={() => setFocusedNodeId(null)}
                onPointerEnter={() => setHoveredNodeId(node.id)}
                onPointerLeave={() => setHoveredNodeId(null)}
              >
                <circle cx={node.x} cy={node.y} r={6} />
                <text x={labelX} y={node.y + 4} textAnchor={anchor}>
                  {node.kind === 'tag' ? '#' : ''}
                  {node.label} ({node.count})
                </text>
              </a>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
