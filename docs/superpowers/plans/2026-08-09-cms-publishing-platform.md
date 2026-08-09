# CMS Publishing Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the owner to safely author, preview, and publish every public blog content type from a browser, including Markdoc component blocks and images.

**Architecture:** Deploy Astro in hybrid mode to one Cloudflare Worker: all existing public routes remain prerendered static assets, while Keystatic owns only `/keystatic` and `/api/keystatic`. Keystatic GitHub storage writes to a `content/<slug>` branch; a Cloudflare preview is reviewed before merge to `v4`, and the existing `draft` flag is a second publication guard. A Worker compatibility spike is an explicit gate; it falls back to a dedicated Node administrator only if the documented checks fail.

**Tech Stack:** Astro 7, `@astrojs/cloudflare`, Cloudflare Workers `nodejs_compat`, Keystatic GitHub mode, GitHub App, Content Collections/zod, Markdoc, Vitest.

## Global Constraints

- Do not store GitHub App credentials, Cloudflare API tokens, or Access credentials in Git.
- Keep every public content page prerendered; `/keystatic` and `/api/keystatic` are the only on-demand routes.
- GitHub App access is restricted to `gze1206/blog.gze1206.net`; it must not receive organization-wide repository access.
- The GitHub App callback URL and Cloudflare Access policy are configured only after the locally built Worker passes its checks.
- Preserve the `draft: true` exclusion in `src/lib/content.ts`.
- Treat existing `.md` entries as migration input; do not delete or publish personal career data without an explicit `visible` value.

---

### Task 1: Prove the Worker CMS runtime (NOR-20)

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml`, `astro.config.mjs`, `keystatic.config.ts`
- Create: `wrangler.jsonc`, `src/integrations/keystatic-runtime.test.ts`

**Interfaces:**

- Consumes: `keystatic.config.ts` and Astro’s injected Keystatic routes.
- Produces: a hybrid Worker build where `GET /` is prerendered and `GET /keystatic` plus `GET /api/keystatic/tree` are on-demand.

- [ ] **Step 1: Write failing runtime assertions**

```ts
import { describe, expect, it } from 'vitest';
import config from '../../../keystatic.config';

describe('remote Keystatic runtime contract', () => {
  it('uses GitHub storage for the canonical repository', () => {
    expect(config.storage).toMatchObject({
      kind: 'github',
      repo: 'gze1206/blog.gze1206.net',
    });
  });
});
```

- [ ] **Step 2: Run the focused test to confirm the local-only configuration fails**

Run: `pnpm test src/integrations/keystatic-runtime.test.ts`

Expected: FAIL because `storage.kind` is `local`.

- [ ] **Step 3: Install the Cloudflare adapter and add the hybrid configuration**

```ts
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'hybrid',
  adapter: cloudflare({ imageService: 'compile', prerenderEnvironment: 'node' }),
});
```

```jsonc
{
  "name": "blog-gze1206-net",
  "compatibility_date": "2026-08-09",
  "compatibility_flags": ["nodejs_compat"],
}
```

- [ ] **Step 4: Enable Keystatic for the Worker and build it**

Replace the dev-only integration with an always-registered Keystatic integration, set
`storage` to `{ kind: 'github', repo: 'gze1206/blog.gze1206.net' }`, and keep all secret
variables undefined locally until the authentication test. Run: `pnpm build`.

Expected: PASS and emits the Worker entrypoint plus prerendered public HTML.

- [ ] **Step 5: Run the Worker locally and verify route separation**

Run: `pnpm preview`, then:

```bash
curl -I http://localhost:4321/
curl -I http://localhost:4321/keystatic
curl -I http://localhost:4321/api/keystatic/tree
```

Expected: `/` returns 200; the two Keystatic routes return a non-404 response. Authentication may return 401/redirect before GitHub App secrets are configured.

- [ ] **Step 6: Commit the proven runtime**

```bash
git add package.json pnpm-lock.yaml astro.config.mjs keystatic.config.ts wrangler.jsonc src/integrations/keystatic-runtime.test.ts
git commit -m "✨ feat(cms): Cloudflare Worker 기반 원격 편집기 구성 (NOR-20)"
```

### Task 2: Make all existing articles CMS-editable (NOR-20)

**Files:**

- Modify: `keystatic.config.ts`, `src/content.config.ts`, `src/lib/content.ts`
- Create: `scripts/verify-mdoc-migration.mjs`, `scripts/verify-mdoc-migration.test.ts`
- Rename: each non-fixture `src/content/posts/*.md` to the same `.mdoc` basename

**Interfaces:**

- Consumes: `postSchema`, `fields.markdoc`, and `RAW_POST_SOURCES`.
- Produces: one `posts` Keystatic collection containing every author-editable article as `.mdoc`.

- [ ] **Step 1: Write a migration inventory test**

```ts
it('has no author-editable Markdown article outside the mdoc collection', async () => {
  const result = await verifyMdocMigration('src/content/posts');
  expect(result.unmigrated).toEqual([]);
});
```

- [ ] **Step 2: Run the focused test before moving content**

Run: `pnpm test scripts/verify-mdoc-migration.test.ts`

Expected: FAIL with the exact list of `.md` source files selected for migration.

- [ ] **Step 3: Move and validate content conservatively**

For every selected post, retain YAML frontmatter, body bytes, slug, dates, draft flag, and URL; change only the extension to `.mdoc`. Exclude test fixtures by an explicit basename allowlist in `verify-mdoc-migration.mjs`, never by a broad date or filename heuristic.

- [ ] **Step 4: Verify rendered URL stability**

Run: `pnpm test scripts/verify-mdoc-migration.test.ts && pnpm build`.

Expected: PASS; every prior non-draft `/blog/<slug>` is still generated and no duplicate source slug error occurs.

- [ ] **Step 5: Commit the migration**

```bash
git add src/content/posts src/content.config.ts src/lib/content.ts scripts/verify-mdoc-migration.mjs scripts/verify-mdoc-migration.test.ts
git commit -m "♻️ refactor(content): 기존 글을 CMS Markdoc 형식으로 이관 (NOR-20)"
```

### Task 3: Model editable profile and career content (NOR-136)

**Files:**

- Modify: `src/content/schemas.ts`, `src/content.config.ts`, `keystatic.config.ts`, `src/lib/content.ts`, `src/pages/index.astro`
- Create: `src/content/profile.json`, `src/content/experience/`, `src/lib/experience.ts`, `src/lib/experience.test.ts`, `keystatic.profile.test.ts`

**Interfaces:**

- Produces: `Profile { name, headline, introduction, skills }` and `Experience { id, organization, role, period, highlights, visible }`.
- Consumes: `getVisibleExperiences(): Promise<CollectionEntry<'experience'>[]>` from `src/lib/experience.ts`.

- [ ] **Step 1: Write failing visibility and order tests**

```ts
it('hides private experience and sorts public experience by end date', () => {
  expect(
    selectVisibleExperiences([
      experience({ id: 'old', endDate: '2024-01-01', visible: true }),
      experience({ id: 'private', endDate: '2026-01-01', visible: false }),
      experience({ id: 'current', endDate: null, visible: true }),
    ]).map((item) => item.id),
  ).toEqual(['current', 'old']);
});
```

- [ ] **Step 2: Run the focused test**

Run: `pnpm test src/lib/experience.test.ts`

Expected: FAIL because `selectVisibleExperiences` does not exist.

- [ ] **Step 3: Add the zod schemas, loaders, and visible selector**

Use `file('src/content/profile.json')` for the singleton and `glob({ base: './src/content/experience', pattern: '**/*.json' })` for entries. Make `organization`, `role`, `period`, `highlights`, and `visible` required; use `endDate: z.coerce.date().nullable()` only for sorting, and do not infer private values from the old blog.

- [ ] **Step 4: Replace hardcoded homepage copy with collection data**

```astro
const [profile, experiences] = await Promise.all([getProfile(), getVisibleExperiences()]); ...
<h1>{profile.data.name}</h1>
{
  experiences.map((experience) => (
    <li>
      {experience.data.organization} · {experience.data.role}
    </li>
  ))
}
```

- [ ] **Step 5: Expose matching Keystatic singleton and collection forms**

Use `singleton({ label: '소개', path: 'src/content/profile' ... })` and `collection({ label: '경력', path: 'src/content/experience/*', format: { data: 'json' } ... })`. Assert their presence and `visible` default in `keystatic.profile.test.ts`.

- [ ] **Step 6: Verify privacy and build output**

Run: `pnpm test src/lib/experience.test.ts keystatic.profile.test.ts && pnpm lint && pnpm build`.

Expected: PASS; a `visible: false` organization string is absent from `dist/index.html` and generated JSON-LD.

- [ ] **Step 7: Commit profile and career management**

```bash
git add src/content src/lib/experience.ts src/lib/experience.test.ts src/pages/index.astro keystatic.config.ts keystatic.profile.test.ts
git commit -m "✨ feat(content): 소개와 경력을 CMS 콘텐츠로 관리 (NOR-136)"
```

### Task 4: Establish authenticated authoring and preview-to-publish operations (NOR-20)

**Files:**

- Modify: `README.md`, `docs/spec/NOR-20-keystatic-web-editor.md`, `docs/release-readiness.md`
- Create: `.env.example`, `docs/operations/cms-authoring.md`

**Interfaces:**

- Consumes: built Worker from Task 1 and GitHub storage from Keystatic.
- Produces: a reproducible owner workflow: authenticate → content branch → preview → merge to `v4` → public deployment.

- [ ] **Step 1: Add a secret-free environment template**

```dotenv
KEYSTATIC_GITHUB_CLIENT_ID=
KEYSTATIC_GITHUB_CLIENT_SECRET=
KEYSTATIC_SECRET=
PUBLIC_KEYSTATIC_GITHUB_APP_SLUG=
```

- [ ] **Step 2: Configure the GitHub App and Cloudflare Worker manually**

Set the OAuth callback to `https://<worker-host>/keystatic/api/github/oauth/callback`, grant only this repository’s Contents read/write permission, and save the four values only in Cloudflare encrypted Worker secrets/variables. Add Cloudflare Access in front of `/keystatic*` and `/api/keystatic*` with the owner’s GitHub identity.

- [ ] **Step 3: Perform the real-device acceptance path**

1. Sign in on phone or tablet through Access and GitHub.
2. Create `content/cms-mobile-smoke` from `v4`.
3. Create a draft `.mdoc` post with bookmark, GitHub, and callout blocks and one uploaded image.
4. Confirm the Cloudflare branch preview renders all blocks and the image.
5. Confirm the `draft` post does not exist in the `v4` public build.
6. Set `draft: false`, merge the reviewed branch into `v4`, and confirm the public URL, RSS, sitemap, and search index include the post.

- [ ] **Step 4: Record evidence without secrets**

Write the Worker URL, preview URL, HTTP status checks, mobile browser/version, and commit SHA to `docs/release-readiness.md` and a single NOR-20 Linear completion comment. Never write tokens, client secrets, or cookies.

- [ ] **Step 5: Commit documentation and move the issue only after evidence exists**

```bash
git add README.md .env.example docs/spec/NOR-20-keystatic-web-editor.md docs/release-readiness.md docs/operations/cms-authoring.md
git commit -m "📝 docs(cms): 원격 작성과 안전한 발행 절차 기록 (NOR-20)"
```

### Task 5: Full quality gate and handoff (NOR-20, NOR-136)

**Files:**

- Modify: `docs/spec/NOR-20-keystatic-web-editor.md`, `docs/spec/NOR-136-profile-career-content.md`

- [ ] **Step 1: Run the full local suite**

Run: `pnpm test && pnpm lint && pnpm format:check && pnpm build`.

Expected: all commands exit 0; no credential-like values appear in `git diff --check` or tracked files.

- [ ] **Step 2: Inspect the generated site**

Run: `rg -n --hidden --glob '!*node_modules*' 'KEYSTATIC_GITHUB_CLIENT_SECRET|KEYSTATIC_SECRET=' .` and inspect `dist/` for `/`, `/blog`, `/topics`, `/rss.xml`, `/sitemap-index.xml`, and the CMS smoke post.

Expected: no secret values in tracked sources or static assets; expected public paths exist; a draft path is absent.

- [ ] **Step 3: Self-review and update Linear**

Review the final diff for accidental personal data, unreviewed public routes, or runtime-only modules in static routes. Mark NOR-20 and NOR-136 Done only after the production/real-device evidence in Task 4 exists; otherwise leave the affected issue In Progress and record the exact external prerequisite.

## Plan self-review

- **Spec coverage:** remote browser authoring, GitHub authentication, images, all three custom blocks, draft/preview/publication, legacy posts, and profile/career privacy map respectively to Tasks 1–4. Task 5 validates them together.
- **Placeholder scan:** no task defers implementation with an unspecified action; the only conditional is the documented Worker compatibility gate, whose pass/fail verification is explicit in Task 1.
- **Type consistency:** Task 3 defines `getVisibleExperiences()` and `selectVisibleExperiences()` before the homepage consumes them. Tasks 1–2 keep `postSchema` and Markdoc as the shared article contract.
