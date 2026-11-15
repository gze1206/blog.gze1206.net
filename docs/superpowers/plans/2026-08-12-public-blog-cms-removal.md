# Public Blog CMS Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keystatic과 동적 Worker 편집 경로를 제거하고, 동일한 공개 콘텐츠를 정적 Astro 블로그로 제공한다.

**Architecture:** Astro의 기본 static output을 사용한다. 작성 UI/API와 GitHub App 설정을 제거하고, `dist/`만 Cloudflare 정적 assets로 배포 가능한 형태로 만든다. 콘텐츠 컬렉션과 React 아일랜드는 유지한다.

**Tech Stack:** Astro 7, TypeScript strict, Markdoc, React islands, Vitest, Wrangler static assets.

## Global Constraints

- NOR-141은 `.mdoc` 포스트, profile, experience, 공개 URL을 보존한다.
- `@astrojs/react`·React는 기존 islands가 사용하므로 제거하지 않는다.
- `/keystatic`과 `/api/keystatic/*`는 정적 preview에서 404여야 한다.
- Cloudflare 계정·도메인·비밀값 변경은 이 계획에서 실행하지 않는다.

---

### Task 1: 정적 출력과 CMS 런타임 제거 (NOR-141)

**Files:**

- Modify: `astro.config.mjs`, `package.json`, `pnpm-lock.yaml`, `wrangler.jsonc`
- Delete: `keystatic.config.ts`, `keystatic.config.test.ts`, `keystatic.profile.test.ts`, `src/integrations/keystatic-worker.ts`, `src/pages/api/keystatic/[...params].ts`, `src/lib/keystatic-api-route.test.ts`, `scripts/verify-cms-worker-build.mjs`, `.env.example`
- Create: `scripts/verify-static-build.mjs`

**Interfaces:** `verify-static-build.mjs` consumes `dist/`; it exits non-zero when a required static artifact is absent or a CMS route is emitted.

- [ ] **Step 1: Write the static build audit first**

```js
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const required = ['index.html', 'blog/index.html', 'rss.xml', 'sitemap-index.xml', 'robots.txt'];
const forbidden = ['keystatic', 'api/keystatic'];
for (const path of required)
  if (!existsSync(resolve('dist', path))) throw new Error(`missing ${path}`);
for (const path of forbidden)
  if (existsSync(resolve('dist', path))) throw new Error(`unexpected CMS output: ${path}`);
```

- [ ] **Step 2: Run the audit against the current build and confirm it fails because CMS still exists**

Run: `pnpm build && node scripts/verify-static-build.mjs`

Expected: FAIL with an unexpected CMS output or Worker-layout error.

- [ ] **Step 3: Remove only CMS-specific configuration and dependencies**

Remove `cloudflare` and `keystaticWorker` imports plus `adapter`/`keystaticWorker()` from `astro.config.mjs`; keep `react()`. Remove `@astrojs/cloudflare`, `@keystar/ui`, `@keystatic/*`, `react-aria`, and `react-stately` only after `pnpm why` confirms no non-CMS consumer. Replace `wrangler.jsonc` with:

```jsonc
{
  "name": "blog-gze1206-net",
  "compatibility_date": "2026-08-12",
  "assets": { "directory": "./dist" },
}
```

- [ ] **Step 4: Delete the listed CMS-only source and test files, then regenerate the lockfile**

Run: `pnpm install && pnpm build && node scripts/verify-static-build.mjs`

Expected: PASS; `dist/server` is absent and every required static artifact exists.

- [ ] **Step 5: Smoke-test public and removed routes**

Run: `pnpm preview --host 127.0.0.1` in one terminal, then `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:4321/`, `/blog/hello-world/`, `/rss.xml`, `/keystatic`, and `/api/keystatic/tree`.

Expected: first three are `200`; last two are `404`.

- [ ] **Step 6: Commit the independent runtime change**

```bash
git add astro.config.mjs package.json pnpm-lock.yaml wrangler.jsonc scripts/verify-static-build.mjs \
  keystatic.config.ts keystatic.config.test.ts keystatic.profile.test.ts src/integrations \
  src/pages/api/keystatic src/lib/keystatic-api-route.test.ts scripts/verify-cms-worker-build.mjs .env.example
git commit -m "♻️ refactor(cms): Keystatic 런타임을 정적 출력으로 전환 (NOR-141)"
```

### Task 2: 콘텐츠와 문서의 현재형 CMS 언급 정리 (NOR-142)

**Files:**

- Modify: `src/content.config.ts`, `src/content/schemas.ts`, `src/content/slug-pattern.ts`, `scripts/verify-home-cms-integration.{mjs,test.ts}`, `src/content/posts/hello-world.mdoc`, `docs/roadmap.md`, `docs/release-readiness.md`, `docs/decisions/README.md`
- Delete: `src/content/posts/keystatic-roundtrip.mdoc`, `docs/operations/cms-authoring.md`
- Create: `docs/decisions/0016-private-workbench-authoring.md`
- Modify: `docs/decisions/0012-keystatic-integration-strategy.md`, `docs/decisions/0015-cms-publishing-runtime-and-workflow.md`

- [ ] **Step 1: Make the existing home-content contract fail on CMS terminology**

Rename the verifier export to `verifyHomeContentIntegration`. Its required-message text must say `home must render profile skills`, not `CMS skills`; the test must import the new module path and assert no direct experience collection read.

- [ ] **Step 2: Rename the verifier and remove CMS-only rationale comments**

Keep the `getProfile()` and `getVisibleExperiences()` boundaries; remove only comments that claim Keystatic owns file shape. Run `pnpm test scripts/verify-home-content-integration.test.ts src/lib/experience.test.ts`.

- [ ] **Step 3: Remove the generated CMS smoke post and revise the launch post**

Delete `keystatic-roundtrip.mdoc`. Replace the `hello-world.mdoc` paragraph with the private-workbench writing boundary; preserve slug, dates, category, tags, and all non-CMS claims.

- [ ] **Step 4: Record the replacement decision without rewriting history**

Create ADR 0016 declaring the private Tailnet workbench the sole authoring entry point. Set ADR 0012 and 0015 frontmatter to `superseded by 0016`; update their index rows. Mark NOR-19/20 as historical in the roadmap and remove CMS setup from release readiness.

- [ ] **Step 5: Verify prose and static output**

Run: `rg -n -i 'KEYSTATIC|/api/keystatic|/keystatic' --glob '!docs/decisions/0012-*' --glob '!docs/decisions/0015-*' --glob '!docs/superpowers/plans/**' . && pnpm test && pnpm lint && pnpm format:check && pnpm build && node scripts/verify-static-build.mjs`

Expected: no live-code/operations references; all quality checks pass.

- [ ] **Step 6: Commit documentation/content cleanup**

```bash
git add src docs scripts
git commit -m "📝 docs(cms): private 작성 경계로 CMS 기록 정리 (NOR-142)"
```

## Final verification

- [ ] Review `git diff v4...HEAD` for accidental content loss.
- [ ] Run `pnpm test && pnpm lint && pnpm format:check && pnpm build && node scripts/verify-static-build.mjs`.
- [ ] Do not run Cloudflare deployment; document static Wrangler command and external secrets/Access cleanup as a final-user action.
