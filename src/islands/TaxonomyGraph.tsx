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
 * 이때도 페이지 위의 정적 탐색 목록은 항상 남아 있다.
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
  const sectionClassName = [
    'taxonomy-graph-section',
    'mt-12',
    activeNodeId === null ? '' : 'is-filtering',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section aria-labelledby="topics-graph-heading" className={sectionClassName}>
      <h2 id="topics-graph-heading" className="text-2xl font-bold tracking-tight">
        분류 맵
      </h2>
      <p className="text-muted mt-2">
        카테고리와 태그의 연결을 보조적으로 살펴봅니다. 선이 진할수록 해당 조합을 다룬 글이
        많습니다.
      </p>
      <div className="taxonomy-graph-legend mt-4" aria-label="분류 맵 범례">
        <span className="taxonomy-graph-legend-item">
          <span
            className="taxonomy-graph-legend-marker taxonomy-graph-legend-marker-category"
            aria-hidden="true"
          />
          <span>카테고리</span>
        </span>
        <span className="taxonomy-graph-legend-item">
          <span
            className="taxonomy-graph-legend-marker taxonomy-graph-legend-marker-tag"
            aria-hidden="true"
          />
          <span>태그</span>
        </span>
      </div>
      <div className="taxonomy-graph-scroll border-border bg-surface mt-5 rounded-lg border p-3">
        <svg
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
          <text className="taxonomy-graph-column-label" x={24} y={28} textAnchor="start">
            카테고리
          </text>
          <text
            className="taxonomy-graph-column-label"
            x={graph.width - 24}
            y={28}
            textAnchor="end"
          >
            태그
          </text>
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
                aria-label={`${node.kind === 'category' ? '카테고리' : '태그'} ${node.label}, 글 ${node.count}개`}
                className={isRelated ? 'taxonomy-graph-node is-related' : 'taxonomy-graph-node'}
                onFocus={() => setFocusedNodeId(node.id)}
                onBlur={() => setFocusedNodeId(null)}
                onPointerEnter={() => setHoveredNodeId(node.id)}
                onPointerLeave={() => setHoveredNodeId(null)}
              >
                <circle
                  className="taxonomy-graph-node-hit-area"
                  cx={node.x}
                  cy={node.y}
                  r={22}
                  aria-hidden="true"
                />
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
