# Task 1 보고 — 결정적 관계 강조 상태

## 구현

- `getRelatedGraphIds()`가 활성 노드와 직접 연결된 이분 그래프 노드만 결정적으로 선택한다.
- SVG의 기존 앵커 링크를 그대로 유지하고, 포인터와 키보드 focus 모두 같은 관계 강조 상태를 설정한다.
- focus 상태를 hover 상태보다 우선해, 포인터가 링크 밖으로 나가도 키보드 focus의 강조가 사라지지 않게 했다.

## RED 증거

생산 코드를 만들기 전에 다음을 실행했다.

```text
pnpm test src/lib/taxonomy-graph-focus.test.ts
Error: Cannot find module './taxonomy-graph-focus'
```

요구한 선택기가 아직 없어서 실패한 상태를 확인했다.

## GREEN 및 검증

```text
pnpm test src/lib/taxonomy-graph-focus.test.ts src/lib/taxonomy-graph.test.ts
2 files passed, 5 tests passed

pnpm test
30 files passed, 309 tests passed

pnpm lint
passed

pnpm format:check
passed

pnpm build
passed (64 pages)
```

`git diff --check`도 통과했다.

## 셀프 리뷰

- anchor를 button으로 교체하지 않았고, 각 노드에 `onFocus`, `onBlur`, `onPointerEnter`, `onPointerLeave`를 모두 연결했다.
- 관계가 없을 때는 노드·선 어느 쪽에도 `is-related`를 추가하지 않는다.
- 클래스 문자열을 재검토하며 조건부 클래스 사이 공백이 누락될 수 있는 형태를 발견해, 명시적인 두 문자열 분기로 수정했다.

## 커밋

`✨ feat(taxonomy): 관계 그래프 강조 탐색 추가 (NOR-137)`를 하나의 커밋으로 기록했다.

## 우려 사항

- 이번 작업은 상태와 클래스만 추가한다. 강조의 색상·선 굵기·focus-visible 시각 디자인은 Task 2 스타일 작업의 범위다.
- 기존 빌드의 500 kB 초과 청크 경고는 남아 있으며, 이 작업에서 새로 발생한 것은 아니다.
