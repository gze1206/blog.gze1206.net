# RSS·사이트맵 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 글의 요약 RSS 피드와 색인 가능한 정적 URL만 담은 사이트맵을 빌드 산출물로 만든다.

**Architecture:** `src/lib/feed.ts`가 Content Collection 글을 RSS 항목으로 변환하는 순수 계약을 제공한다. `src/pages/rss.xml.ts`는 그 계약과 `@astrojs/rss`만 조합하고, Astro sitemap 통합은 이미 설정된 정규 사이트 URL을 사용해 `/smoke/`를 제외한다.

**Tech Stack:** Astro 7 static output, `@astrojs/rss`, `@astrojs/sitemap`, TypeScript strict, Vitest.

## Global Constraints

- `astro.config.mjs`의 `site: 'https://gze1206.net'`와 `trailingSlash: 'never'`를 URL의 단일 출처로 사용한다.
- draft 글은 `getVisiblePosts()`로만 제외하고, RSS는 `description` 요약만 제공한다.
- `/smoke/`는 robots, RSS, sitemap 어디에도 색인 가능한 URL로 노출하지 않는다.
- 새 동작은 Vitest가 먼저 실패하는 것을 확인하고 구현한다.
- 사용자 요청에 따라 검증된 논리 단위마다 Korean gitmoji Conventional 커밋과 `NOR-30`을 남긴다.

---

### Task 1: RSS 항목 계약과 엔드포인트

**Files:**

- Create: `src/lib/feed.ts`
- Create: `src/lib/feed.test.ts`
- Create: `src/pages/rss.xml.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `PostLike` from `src/lib/posts.ts`, `absoluteUrl()` from `src/lib/site-meta.ts`.
- Produces: `toRssItems(posts, site): RssItem[]`, where each item has title, description, link, pubDate, and customData.

- [x] **Step 1: Write the failing test**

```ts
expect(toRssItems([visiblePost, draftPost], 'https://gze1206.net')).toEqual([
  expect.objectContaining({
    title: visiblePost.data.title,
    description: visiblePost.data.description,
    link: 'https://gze1206.net/blog/hello-world',
    pubDate: visiblePost.data.publishedAt,
    customData: expect.stringContaining('<category>'),
  }),
]);
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/feed.test.ts`

Expected: FAIL because `src/lib/feed.ts` does not exist.

- [x] **Step 3: Install the production package and implement the pure mapper**

```bash
pnpm add @astrojs/rss
```

Implement `toRssItems()` by filtering `draft`, generating the canonical `/blog/[slug]` URL, and serializing only de-duplicated category and tags in `customData`. Do not embed unrendered Markdoc body content in the feed.

- [x] **Step 4: Add the endpoint**

```ts
export async function GET(context: APIContext) {
  return rss({
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    site: context.site,
    items: toRssItems(await getVisiblePosts(), context.site),
    customData: '<language>ko-KR</language>',
  });
}
```

- [x] **Step 5: Run the focused test and build**

Run: `pnpm vitest run src/lib/feed.test.ts && pnpm build`

Expected: PASS, and `dist/rss.xml` contains only published article links and `ko-KR` language metadata.

- [x] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/feed.ts src/lib/feed.test.ts src/pages/rss.xml.ts
git commit -m "✨ feat(feed): 공개 글 요약 RSS 제공 (NOR-30)"
```

### Task 2: 사이트맵·robots 연동과 산출물 검증

**Files:**

- Modify: `astro.config.mjs`
- Modify: `public/robots.txt`
- Create: `src/lib/sitemap.ts`
- Create: `src/lib/sitemap.test.ts`

**Interfaces:**

- Consumes: sitemap 통합의 `filter(page: string): boolean`과 URL pathname.
- Produces: `isSitemapPage(page: string): boolean`, which rejects only the `/smoke` path and its descendants.

- [x] **Step 1: Write the failing test**

```ts
expect(isSitemapPage('https://gze1206.net/smoke/cil')).toBe(false);
expect(isSitemapPage('https://gze1206.net/blog/smoke-test-post')).toBe(true);
expect(isSitemapPage('https://gze1206.net/blog')).toBe(true);
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/sitemap.test.ts`

Expected: FAIL because `src/lib/sitemap.ts` does not exist.

- [x] **Step 3: Implement the pathname predicate and wire the integration**

```ts
import sitemap from '@astrojs/sitemap';
import { isSitemapPage } from './src/lib/sitemap.ts';

integrations: [
  sitemap({ filter: isSitemapPage }),
  markdoc(),
  react(),
  keystaticDev(),
  ogImageAudit(),
];
```

`public/robots.txt`의 TODO를 `Sitemap: https://gze1206.net/sitemap-index.xml` 한 줄로 교체한다.

- [x] **Step 4: Run focused test and inspect built XML**

Run: `pnpm vitest run src/lib/sitemap.test.ts && pnpm build && rg -n '/smoke/|/rss.xml' dist/sitemap-*.xml dist/robots.txt`

Expected: predicate test PASS, sitemap has no `/smoke/` URL, and `dist/robots.txt` points to sitemap index. `rss.xml`의 포함 여부는 Astro 통합의 정적 라우트 동작에 따라 확인해 문서화한다.

- [x] **Step 5: Commit**

```bash
git add astro.config.mjs public/robots.txt src/lib/sitemap.ts src/lib/sitemap.test.ts
git commit -m "✨ feat(sitemap): 색인 가능한 URL과 robots 연결 (NOR-30)"
```

### Task 3: 전체 검증과 Linear 완료 처리

**Files:**

- Modify: `docs/spec/NOR-30-rss-sitemap.md`

- [x] **Step 1: Record the actual feed policy and validation output**

Document that RSS uses frontmatter descriptions, includes only published posts, and that sitemap excludes smoke routes.

- [x] **Step 2: Run the project verification suite**

Run: `pnpm test && pnpm lint && pnpm build && pnpm format:check`

Expected: all pass; retain any pre-existing Vite Mermaid chunk warning as an audit note rather than increasing its warning threshold.

- [x] **Step 3: Self-review and commit the result**

Check `git diff --check`, inspect generated `dist/rss.xml`, `dist/sitemap-index.xml`, and `dist/robots.txt`, then commit the spec update.

- [x] **Step 4: Update Linear**

Post one concise completion comment with commit ids and verification results; move NOR-30 to Done only after the generated feed, sitemap, and robots reference all pass inspection.

## Self-Review

- Spec coverage: RSS policy and generation are Task 1; sitemap generation and robots reference are Task 2; build artefact verification and Linear state are Task 3.
- Placeholder scan: no TBD/TODO or unspecified implementation steps remain.
- Type consistency: Task 1 exposes `toRssItems(posts, site)` for the endpoint; Task 2 exposes `isSitemapPage(page)` for Astro config; the two modules do not depend on each other.
