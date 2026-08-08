# Taxonomy Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카테고리·태그의 기존 분류 계약을 보존하면서 `/topics` 통합 탐색과 접근 가능한 관계 그래프를 제공한다.

**Architecture:** 순수 `taxonomy-graph` 모듈이 노드·간선·결정적 SVG 레이아웃을 만들고, Astro 정적 탐색 목록과 React SVG 아일랜드가 같은 DTO를 소비한다. 그래프는 `client:visible` 보조 기능이며 모든 분류 링크는 정적 HTML에 먼저 존재한다.

**Tech Stack:** Astro 7, TypeScript strict, Content Collections, Tailwind CSS 4, React 19 island, Vitest.

## Global Constraints

- `category`는 상위 분류, `tags`는 세부 주제이며 post 스키마와 개별 결과 URL을 변경하지 않는다.
- `/category/[slug]`, `/tags/[slug]`는 계속 정적 생성한다.
- 그래프는 라이브러리·canvas·WebGL 없이 SVG로 그리고 `client:visible`을 사용한다.
- `prefers-reduced-motion`과 JS 미지원에서 정적 HTML 목록이 완전한 탐색 경로다.
- 외부 링크나 배포·도메인 설정은 이 범위에 포함하지 않는다.
- 매 태스크는 `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm format:check` 중 영향 범위 검사를 통과하고 커밋한다.

---

## 파일 구조

- Create: `src/lib/taxonomy-graph.ts` — taxonomy 노드·가중 간선·SVG 좌표를 순수하게 파생한다.
- Create: `src/lib/taxonomy-graph.test.ts` — 중복·가중치·정렬·레이아웃 불변식을 고정한다.
- Create: `src/components/TaxonomyExplorer.astro` — JS 없이 읽히는 통합 목록을 렌더한다.
- Create: `src/islands/TaxonomyGraph.tsx` — 보조 SVG 링크 그래프를 렌더한다.
- Create: `src/pages/topics.astro` — 목록과 `client:visible` 아일랜드를 조립한다.
- Modify: `src/lib/routes.ts`, `src/lib/routes.test.ts` — `topicsPath()` 단일 URL 출처를 제공한다.
- Modify: `src/components/SiteHeader.astro` — 두 인덱스 메뉴를 `/topics`의 `분류` 하나로 바꾼다.
- Modify: `src/pages/category/index.astro`, `src/pages/tags/index.astro` — 기존 목록을 보존하고 통합 인덱스 안내를 추가한다.
- Modify: `src/styles/global.css` — SVG 컨테이너와 모션 축소 폴백만 추가한다.

### Task 1: 결정적 분류 그래프 데이터

**Files:**

- Create: `src/lib/taxonomy-graph.ts`
- Create: `src/lib/taxonomy-graph.test.ts`

**Interfaces:**

- Consumes: `PostLike` from `src/lib/posts.ts`.
- Produces: `buildTaxonomyGraph(posts: readonly PostLike[]): TaxonomyGraph` and `layoutTaxonomyGraph(graph: TaxonomyGraph): TaxonomyGraphLayout`.

- [ ] **Step 1: Write failing graph derivation tests**

```ts
expect(buildTaxonomyGraph(posts).edges).toEqual([
  { categorySlug: 'dev', tagSlug: 'astro', weight: 2 },
]);
expect(buildTaxonomyGraph(posts).nodes.map((node) => node.id)).toEqual([
  'category:dev',
  'tag:astro',
]);
```

Include a post with duplicate `astro` tags and labels whose insertion order differs from Korean locale order.

- [ ] **Step 2: Run the focused test to verify failure**

Run: `pnpm test -- src/lib/taxonomy-graph.test.ts`

Expected: FAIL because `./taxonomy-graph` does not exist.

- [ ] **Step 3: Implement the minimal pure graph module**

```ts
export interface TaxonomyGraphNode {
  id: string;
  kind: 'category' | 'tag';
  slug: string;
  label: string;
  count: number;
}
export interface TaxonomyGraphEdge {
  categorySlug: string;
  tagSlug: string;
  weight: number;
}
export function buildTaxonomyGraph(posts: readonly PostLike[]): TaxonomyGraph {
  /* Map + Set */
}
```

Use `Set(post.data.tags)` so duplicate tags in a source post do not inflate node counts or edge weights. Sort nodes by `label.localeCompare(label, 'ko')` and edges by category then tag label.

- [ ] **Step 4: Add and pass deterministic layout tests**

Assert all category nodes have `x === 80`, all tag nodes have `x === width - 80`, and repeated inputs create byte-for-byte equal layouts.

Run: `pnpm test -- src/lib/taxonomy-graph.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/taxonomy-graph.ts src/lib/taxonomy-graph.test.ts
git commit -m "✨ feat(topics): 분류 관계 그래프 데이터 추가 (NOR-135)"
```

### Task 2: 정적 통합 분류 탐색

**Files:**

- Create: `src/components/TaxonomyExplorer.astro`
- Create: `src/pages/topics.astro`
- Modify: `src/lib/routes.ts`
- Modify: `src/lib/routes.test.ts`

**Interfaces:**

- Consumes: `getCategoryGroups()`, `getTagGroups()`, `getVisiblePosts()`, `buildTaxonomyGraph()` and `topicsPath()`.
- Produces: `/topics` static HTML containing all category and tag result links.

- [ ] **Step 1: Write a failing route helper test**

```ts
expect(topicsPath()).toBe('/topics');
```

Run: `pnpm test -- src/lib/routes.test.ts`

Expected: FAIL because `topicsPath` is not exported.

- [ ] **Step 2: Add the URL helper and static page**

```ts
export function topicsPath(): string {
  return '/topics';
}
```

`TaxonomyExplorer` receives category and tag groups, creates `section` elements for categories, category-scoped tags, and all tags, and uses `categoryPath()`/`tagPath()` for every href. `topics.astro` obtains all data at build time and renders the component before the graph island.

- [ ] **Step 3: Verify the static fallback**

Run: `pnpm test -- src/lib/routes.test.ts && pnpm build && rg -q '카테고리별 태그' dist/topics/index.html && rg -q '/category/' dist/topics/index.html && rg -q '/tags/' dist/topics/index.html`

Expected: PASS and `/topics` contains all three textual navigation sections.

- [ ] **Step 4: Commit**

```bash
git add src/lib/routes.ts src/lib/routes.test.ts src/components/TaxonomyExplorer.astro src/pages/topics.astro
git commit -m "✨ feat(topics): 정적 통합 분류 탐색 추가 (NOR-135)"
```

### Task 3: 선택적 SVG 관계 그래프

**Files:**

- Create: `src/islands/TaxonomyGraph.tsx`
- Modify: `src/pages/topics.astro`
- Modify: `src/styles/global.css`

**Interfaces:**

- Consumes: `TaxonomyGraphLayout` from `src/lib/taxonomy-graph.ts`, `categoryPath()`, `tagPath()`.
- Produces: `TaxonomyGraph` React component rendered with `client:visible`.

- [ ] **Step 1: Extend focused tests for SVG-facing layout data**

```ts
const layout = layoutTaxonomyGraph(buildTaxonomyGraph(posts));
expect(layout.width).toBeGreaterThan(0);
expect(layout.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
```

Run: `pnpm test -- src/lib/taxonomy-graph.test.ts`

Expected: FAIL until the layout DTO has width, height and coordinates.

- [ ] **Step 2: Render SVG links without a visualisation dependency**

`TaxonomyGraph` returns `null` when `matchMedia('(prefers-reduced-motion: reduce)').matches` is true. Otherwise it renders `<svg role="img">`, a `<title>`, a `<desc>`, weighted `<line>` edges, and a `<a href>` + `<circle>` + `<text>` for each node. Category nodes use `categoryPath`, tag nodes use `tagPath`.

- [ ] **Step 3: Add CSS that preserves the fallback**

Use `.taxonomy-graph-scroll { overflow-x: auto; }` and `@media (prefers-reduced-motion: reduce) { .taxonomy-graph-region { display: none; } }`. Do not hide the preceding `TaxonomyExplorer` sections.

- [ ] **Step 4: Verify build output**

Run: `pnpm test -- src/lib/taxonomy-graph.test.ts && pnpm lint && pnpm build && rg -q 'TaxonomyGraph' dist/topics/index.html`

Expected: PASS; Astro island markup occurs after the static explorer HTML.

- [ ] **Step 5: Commit**

```bash
git add src/islands/TaxonomyGraph.tsx src/pages/topics.astro src/styles/global.css src/lib/taxonomy-graph.ts src/lib/taxonomy-graph.test.ts
git commit -m "✨ feat(topics): 지연 로드 관계 그래프 추가 (NOR-135)"
```

### Task 4: 기존 인덱스 호환과 내비게이션 전환

**Files:**

- Modify: `src/components/SiteHeader.astro`
- Modify: `src/pages/category/index.astro`
- Modify: `src/pages/tags/index.astro`

**Interfaces:**

- Consumes: `topicsPath()`.
- Produces: 헤더의 단일 `분류` 링크 및 기존 인덱스의 `/topics` 안내 링크.

- [ ] **Step 1: Add a focused rendered-output assertion command**

```bash
pnpm build
rg -q 'href="/topics"' dist/index.html
rg -q '분류 탐색' dist/category/index.html
rg -q '분류 탐색' dist/tags/index.html
```

Expected before the implementation: FAIL because the header still has separate category/tag links.

- [ ] **Step 2: Implement compatibility navigation**

Replace the two `NAV_ITEMS` entries with `{ href: topicsPath(), label: '분류' }`. Keep each legacy index’s existing `TaxonomyIndex`; add a visible introduction link to `topicsPath()` instead of a redirect.

- [ ] **Step 3: Run full verification**

Run: `git diff --check && pnpm test && pnpm lint && pnpm build && pnpm format:check`

Expected: all pass, including `/topics`, legacy index, and individual result routes in `dist`.

- [ ] **Step 4: Commit and Linear completion**

```bash
git add src/components/SiteHeader.astro src/pages/category/index.astro src/pages/tags/index.astro
git commit -m "✨ feat(topics): 분류 메뉴와 기존 인덱스 호환 (NOR-135)"
orca linear status set NOR-135 --to Done --workspace fc6501e7-358c-4468-bd01-b7cadcc699f7
```

## Self-review

- Spec coverage: Task 1 covers relation semantics and determinism; Task 2 covers static HTML fallback and new route; Task 3 covers the optional accessible SVG island and motion handling; Task 4 preserves legacy URL compatibility and changes navigation.
- Placeholder scan: no TBD/TODO/implicit test instructions remain.
- Type consistency: Task 1 defines `TaxonomyGraph` and `TaxonomyGraphLayout`; Tasks 2 and 3 consume those exact names. `topicsPath()` is defined in Task 2 before Task 4 uses it.
