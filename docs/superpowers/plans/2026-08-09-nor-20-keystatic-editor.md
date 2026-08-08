# NOR-20 Keystatic Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable local Keystatic authors to insert the three supported Markdoc blocks and upload post images without changing the static production deployment.

**Architecture:** Extend only the posts `fields.markdoc` configuration. Component-block schemas mirror `markdoc.config.mjs` and `docs/spec/NOR-15-custom-blocks.md`; image assets are written below `public/uploads` and serialized with the `/uploads/` public path.

**Tech Stack:** Keystatic 0.6, TypeScript strict, Vitest, Astro static build.

## Global Constraints

- Keep `storage: { kind: 'local' }` and the dev-only Keystatic integration from ADR 0012.
- Do not add GitHub OAuth secrets, an adapter, or production admin routes.
- Map exactly `bookmark`, `github`, and `callout`; preserve all Markdoc attribute names.

---

### Task 1: Test and configure Keystatic authoring blocks

**Files:**

- Create: `keystatic.config.test.ts`
- Modify: `keystatic.config.ts`

**Interfaces:**

- Produces: posts `content` editor with `componentBlocks` and `{ directory: 'public/uploads', publicPath: '/uploads/' }` image options.

- [ ] **Step 1: Write failing configuration assertions**

Import the configuration and assert that the posts content field exposes `bookmark`, `github`, and `callout`, with image directory `public/uploads` and public path `/uploads/`.

- [ ] **Step 2: Run the focused test**

Run: `pnpm test keystatic.config.test.ts`

Expected: FAIL because component blocks and image options are absent.

- [ ] **Step 3: Add the minimal schema mapping**

Use `fields.markdoc({ extension: 'mdoc', options: { image: { directory: 'public/uploads', publicPath: '/uploads/' }, components: { ... } } })`.
Map bookmark attributes `url`, `title`, `description`, `image`, `siteName`; github `repo`, `description`, `stars`, `language`; and callout `type`, `title`, `children` with the six allowed type values.

- [ ] **Step 4: Verify configuration and static safety**

Run: `pnpm test keystatic.config.test.ts && pnpm lint && pnpm build`

Expected: PASS; no `dist/keystatic` or `dist/api` directory.

- [ ] **Step 5: Commit**

```bash
git add keystatic.config.ts keystatic.config.test.ts docs/spec/NOR-20-keystatic-web-editor.md docs/superpowers/plans/2026-08-09-nor-20-keystatic-editor.md
git commit -m "✨ feat(cms): Keystatic 블럭 삽입과 이미지 업로드 추가 (NOR-20)"
```
