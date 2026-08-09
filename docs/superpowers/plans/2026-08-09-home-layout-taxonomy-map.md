# Home Layout and Taxonomy Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home page a calm developer portfolio surface and make `/topics` a clear, keyboard-accessible category-to-tag relationship map.

**Architecture:** Keep pages prerendered. Home replaces the WebGL island with CSS-only decorative layers and semantic content sections. `/topics` keeps `TaxonomyExplorer` as static navigation and adds a small React state model to the existing SVG so focus or hover isolates directly related nodes and edges.

**Tech Stack:** Astro, TypeScript strict, React island, Tailwind, CSS custom properties, Vitest.

## Global Constraints

- The home page must not load or render `InteractiveCanvas` or a WebGL canvas.
- Decoration must be `pointer-events: none`, visually subordinate to content, and contain no animation.
- `/topics` is the only page that renders the category/tag graph.
- Static category and tag links remain available without JavaScript and remain the primary fallback.
- Every SVG graph node remains a real link with the category/tag route as its `href`.
- Pointer hover and keyboard focus expose the same directly-related node and edge emphasis.
- Do not add a visualization dependency or a runtime fetch.

---

### Task 1: Add deterministic relationship emphasis state (NOR-137)

**Files:**

- Create: `src/lib/taxonomy-graph-focus.ts`, `src/lib/taxonomy-graph-focus.test.ts`
- Modify: `src/islands/TaxonomyGraph.tsx`

**Interfaces:**

- Consumes: `TaxonomyGraphLayout` nodes and edges from `src/lib/taxonomy-graph.ts`.
- Produces: `getRelatedGraphIds(graph, activeNodeId): ReadonlySet<string>` where the set contains the active node plus each directly connected node; `null` returns an empty set.

- [ ] **Step 1: Write failing relationship tests**

```ts
import { describe, expect, it } from 'vitest';
import { getRelatedGraphIds } from './taxonomy-graph-focus';

describe('getRelatedGraphIds', () => {
  it('활성 카테고리와 직접 연결된 태그만 강조 대상으로 반환한다', () => {
    expect(getRelatedGraphIds(graph, 'category:개발')).toEqual(
      new Set(['category:개발', 'tag:astro', 'tag:typescript']),
    );
  });

  it('활성 노드가 없으면 강조 대상을 만들지 않는다', () => {
    expect(getRelatedGraphIds(graph, null)).toEqual(new Set());
  });
});
```

- [ ] **Step 2: Verify the focused test is red**

Run: `pnpm test src/lib/taxonomy-graph-focus.test.ts`

Expected: FAIL because `getRelatedGraphIds` does not exist.

- [ ] **Step 3: Implement the minimal graph focus selector**

```ts
export function getRelatedGraphIds(
  graph: Pick<TaxonomyGraphLayout, 'edges'>,
  activeNodeId: string | null,
): ReadonlySet<string> {
  if (activeNodeId === null) return new Set();
  const related = new Set([activeNodeId]);
  for (const edge of graph.edges) {
    const categoryId = `category:${edge.categorySlug}`;
    const tagId = `tag:${edge.tagSlug}`;
    if (activeNodeId === categoryId) related.add(tagId);
    if (activeNodeId === tagId) related.add(categoryId);
  }
  return related;
}
```

- [ ] **Step 4: Wire state into the SVG links**

Use `useState<string | null>(null)`. Each graph link receives `onFocus`, `onBlur`, `onPointerEnter`, and `onPointerLeave`; edge and node class names include `is-related` only while an active node exists. Do not replace the anchor elements with buttons.

- [ ] **Step 5: Verify green**

Run: `pnpm test src/lib/taxonomy-graph-focus.test.ts src/lib/taxonomy-graph.test.ts`

Expected: PASS; existing deterministic layout tests remain green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/taxonomy-graph-focus.ts src/lib/taxonomy-graph-focus.test.ts src/islands/TaxonomyGraph.tsx
git commit -m "✨ feat(taxonomy): 관계 그래프 강조 탐색 추가 (NOR-137)"
```

### Task 2: Refine the `/topics` information hierarchy and graph presentation (NOR-137)

**Files:**

- Modify: `src/pages/topics.astro`, `src/islands/TaxonomyGraph.tsx`, `src/components/TaxonomyExplorer.astro`, `src/styles/global.css`

**Interfaces:**

- Consumes: the Task 1 active-node state and the existing `TaxonomyGraphLayout`.
- Produces: a `/topics` page whose static explorer precedes the optional graph and whose graph exposes category/tag columns, a legend, focus emphasis, and horizontal-scroll fallback.

- [ ] **Step 1: Write the failing static markup contract**

Create `src/pages/topics.test.ts` that reads `src/pages/topics.astro` and asserts it contains `분류 맵`; read `src/islands/TaxonomyGraph.tsx` and assert it contains the visible legend labels `카테고리` and `태그`, SVG `title`/`desc`, and anchor `href` construction.

- [ ] **Step 2: Verify the contract is red**

Run: `pnpm test src/pages/topics.test.ts`

Expected: FAIL because the current page has neither the `분류 맵` framing nor a visible category/tag legend.

- [ ] **Step 3: Implement the accessible presentation**

- Change the header copy to introduce “분류 맵” as a secondary visual way to inspect the same taxonomy.
- Add a visible graph legend naming category and tag node styles.
- Add `data-related` or explicit `is-related` classes to edges and nodes; dim non-related graph marks only while a node is active.
- Keep the graph below `TaxonomyExplorer`; never hide the explorer under reduced motion.
- Add CSS that gives the graph a restrained inset surface, labeled columns, 44px-equivalent link hit area through transparent SVG link padding or focusable node group styling, visible focus ring, and `overflow-x: auto` on narrow screens.

- [ ] **Step 4: Verify green and build output**

Run: `pnpm test src/pages/topics.test.ts src/lib/taxonomy-graph-focus.test.ts && pnpm build`

Expected: PASS; `dist/client/topics/index.html` contains static category/tag links even though the graph island is client-visible.

- [ ] **Step 5: Commit**

```bash
git add src/pages/topics.astro src/pages/topics.test.ts src/islands/TaxonomyGraph.tsx src/components/TaxonomyExplorer.astro src/styles/global.css
git commit -m "🎨 style(topics): 분류 맵 탐색 계층 정돈 (NOR-137)"
```

### Task 3: Replace the home WebGL background with a portfolio layout (NOR-137)

**Files:**

- Create: `scripts/verify-home-layout.mjs`, `scripts/verify-home-layout.test.ts`
- Modify: `src/pages/index.astro`, `src/styles/global.css`
- Delete: `src/islands/InteractiveCanvas.tsx`, `src/lib/interactive-canvas.ts`, `src/lib/interactive-canvas.test.ts`

**Interfaces:**

- Consumes: the existing profile, portfolio, and visible-post collection calls in `src/pages/index.astro`.
- Produces: `verifyHomeLayout(html: string): string[]`, returning missing required semantic markers; an empty array means the prerendered home page has no canvas and retains the approved content hierarchy.

- [ ] **Step 1: Write the failing built-home verification**

```ts
import { expect, it } from 'vitest';
import { verifyHomeLayout } from './verify-home-layout.mjs';

it('홈은 캔버스 없이 포트폴리오 정보 위계를 렌더한다', () => {
  const html = '<main><canvas></canvas><h1>gze1206</h1></main>';
  expect(verifyHomeLayout(html)).toEqual([
    'canvas must not be present',
    'portfolio section is missing',
    'recent posts section is missing',
  ]);
});
```

- [ ] **Step 2: Verify the focused test is red**

Run: `pnpm test scripts/verify-home-layout.test.ts`

Expected: FAIL because `verifyHomeLayout` does not exist.

- [ ] **Step 3: Implement the verifier and portfolio layout**

- Implement `verifyHomeLayout` by checking for no `<canvas`, `about-heading`, `stack-heading`, `portfolio-heading`, and `recent-posts-heading` markers.
- Remove the `InteractiveCanvas` import and its render from `src/pages/index.astro`.
- Wrap the profile area in a semantic `home-hero` surface with a CSS-only `home-hero__decoration` sibling marked `aria-hidden="true"`.
- Give project cards, technology tokens, and recent-post metadata shared `home-*` class hooks. Use CSS for subtle grid/gradient decoration; it must have no animation and no pointer events.
- Delete the now-unreferenced Three/WebGL island and its isolated helper/test files.

- [ ] **Step 4: Verify the generated home page**

Run: `pnpm test scripts/verify-home-layout.test.ts && pnpm build && node -e "import('./scripts/verify-home-layout.mjs').then(async ({ verifyHomeLayout }) => { const { readFile } = await import('node:fs/promises'); const html = await readFile('dist/client/index.html', 'utf8'); const missing = verifyHomeLayout(html); if (missing.length) throw new Error(missing.join(', ')); })"`

Expected: PASS; home output has the required sections and no canvas.

- [ ] **Step 5: Run final local quality gate**

Run: `pnpm test && pnpm lint && pnpm format:check && pnpm build`

Expected: all commands exit 0. Confirm `rg -n 'InteractiveCanvas|interactive-canvas|<canvas' src dist/client/index.html` returns no home-rendered canvas reference.

- [ ] **Step 6: Commit**

```bash
git add src/pages/index.astro src/styles/global.css scripts/verify-home-layout.mjs scripts/verify-home-layout.test.ts src/islands/InteractiveCanvas.tsx src/lib/interactive-canvas.ts src/lib/interactive-canvas.test.ts
git commit -m "🎨 style(home): 포트폴리오 레이아웃으로 정돈 (NOR-137)"
```

## Plan self-review

- **Spec coverage:** Task 3 covers the calm, non-WebGL home hierarchy and decorative constraints. Tasks 1–2 cover the `/topics`-only category/tag graph, static fallback, keyboard parity, and mobile overflow.
- **Placeholder scan:** no TBD/TODO steps or unspecified tests remain.
- **Type consistency:** `getRelatedGraphIds()` receives graph edges and returns node IDs consumed by `TaxonomyGraph`; `verifyHomeLayout()` consumes built HTML and returns string diagnostics consumed by its test and final build check.
