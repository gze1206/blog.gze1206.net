import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaxonomyMap as TaxonomyMapModel } from '../lib/taxonomy-map';
import {
  isEdgeVisible,
  queryFromSelectionId,
  selectionIdFromQuery,
  selectTaxonomyNode,
} from '../lib/taxonomy-map-selection';

/** 노드 하나를 골랐을 때 아래 패널이 보여 줄 것. 서버에서 만들어 넘긴다. */
export interface TaxonomyNodeDetail {
  readonly label: string;
  readonly kindLabel: string;
  readonly href: string;
  readonly postCount: number;
  readonly articles: readonly {
    readonly title: string;
    readonly href: string;
    readonly meta: string;
  }[];
}

interface Props {
  readonly map: TaxonomyMapModel;
  readonly details: Readonly<Record<string, TaxonomyNodeDetail>>;
}

/**
 * 분류 관계 지도 (NOR-152).
 *
 * 좌표는 빌드타임에 정해져 오고, 여기서는 **그리기와 고르기**만 한다. 노드와 간선이 같은
 * 좌표 배열을 쓰므로 선 끝이 노드에서 어긋날 수 없다.
 *
 * 노드는 실제 링크다. 클릭은 지도 안에서 선택으로 처리하지만, 가운데 클릭·새 탭 열기·키보드
 * 이동은 브라우저 기본 동작으로 남는다. 지도가 없어도 페이지의 정적 목록으로 같은 곳에 갈 수 있다.
 */
export default function TaxonomyMap({ map, details }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 주소로 들어온 선택을 복원한다. 뒤로 가기도 같은 경로를 탄다.
  useEffect(() => {
    const sync = () => setSelectedId(selectionIdFromQuery(new URLSearchParams(location.search)));
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const select = useCallback((nodeId: string | null) => {
    setSelectedId(nodeId);
    const query = queryFromSelectionId(nodeId);
    history.pushState(null, '', query === '' ? location.pathname : query);
  }, []);

  const selection = useMemo(() => selectTaxonomyNode(map, selectedId), [map, selectedId]);
  const nodePositions = useMemo(
    () => new Map(map.nodes.map((node) => [node.id, node])),
    [map.nodes],
  );
  const detail = selection.nodeId === null ? undefined : details[selection.nodeId];

  const isDimmed = (nodeId: string): boolean =>
    selection.nodeId !== null && !selection.visibleNodeIds.has(nodeId);

  return (
    <section className="taxonomy-map" aria-labelledby="taxonomy-map-heading">
      <div className="taxonomy-map__bar">
        <h2 id="taxonomy-map-heading" className="taxonomy-map__title">
          관계 지도
        </h2>
        <p className="taxonomy-map__hint">
          카테고리와 태그가 글에서 만나는 빈도입니다. 노드를 고르면 그 주변만 남습니다.
        </p>
        {selection.nodeId !== null && (
          <button type="button" className="taxonomy-map__clear" onClick={() => select(null)}>
            선택 해제
          </button>
        )}
      </div>

      <div className="taxonomy-map__canvas">
        <svg
          viewBox={`0 0 ${map.width} ${map.height}`}
          role="img"
          aria-label="카테고리와 태그의 관계 지도"
        >
          <g className="taxonomy-map__edges">
            {map.edges
              .filter((edge) => isEdgeVisible(edge, selection))
              .map((edge) => {
                const source = nodePositions.get(edge.sourceId);
                const target = nodePositions.get(edge.targetId);
                if (source === undefined || target === undefined) return null;
                const strength = map.maxWeight === 0 ? 0 : edge.weight / map.maxWeight;

                return (
                  <line
                    key={`${edge.kind}:${edge.sourceId}:${edge.targetId}`}
                    className={`taxonomy-map__edge taxonomy-map__edge--${edge.kind}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    strokeWidth={edge.kind === 'co' ? 1 : 1 + strength * 2.6}
                    opacity={edge.kind === 'co' ? 0.35 : 0.3 + strength * 0.5}
                  />
                );
              })}
          </g>

          <g className="taxonomy-map__nodes">
            {map.nodes.map((node) => {
              const nodeDetail = details[node.id];
              const selected = selection.nodeId === node.id;

              return (
                <a
                  key={node.id}
                  href={nodeDetail?.href ?? '#'}
                  className={[
                    'taxonomy-map__node',
                    `taxonomy-map__node--${node.kind}`,
                    selected ? 'is-selected' : '',
                    isDimmed(node.id) ? 'is-dimmed' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={(event) => {
                    // 새 탭·다른 창으로 여는 조작은 브라우저에 맡긴다.
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
                      return;
                    event.preventDefault();
                    select(selected ? null : node.id);
                  }}
                  aria-pressed={selected}
                >
                  <circle cx={node.x} cy={node.y} r={node.radius} />
                  <text x={node.x} y={node.y + node.radius + 13} textAnchor="middle">
                    {node.label}
                  </text>
                </a>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="taxonomy-map__context">
        {detail === undefined ? (
          <p className="taxonomy-map__empty">
            전체 관계를 보고 있습니다. 카테고리나 태그를 고르면 그 주변 관계와 이어 읽을 글이 여기에
            나타납니다.
          </p>
        ) : (
          <>
            <div>
              <p className="taxonomy-map__label">선택한 분류</p>
              <h3 className="taxonomy-map__selected">{detail.label}</h3>
              <p className="taxonomy-map__signals">
                <span>
                  <b>{detail.postCount}</b> 글
                </span>
                <span>
                  <b>{selection.directNodeIds.size}</b> 직접 연결
                </span>
                <span>{detail.kindLabel}</span>
              </p>
              <p className="taxonomy-map__action">
                <a href={detail.href}>{detail.label} 글 전체 보기 →</a>
              </p>
            </div>
            <div>
              <p className="taxonomy-map__label">이어 읽기</p>
              <ul className="taxonomy-map__articles">
                {detail.articles.map((article) => (
                  <li key={article.href}>
                    <a href={article.href}>{article.title}</a>
                    <span>{article.meta}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
