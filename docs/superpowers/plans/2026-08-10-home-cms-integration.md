# Home CMS Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render CMS-managed profile and public career content in the NOR-137 portfolio home without weakening privacy or accessibility contracts.

**Architecture:** Start from the latest NOR-20 Worker branch, merge the NOR-136 profile branch and NOR-137 layout branch, then resolve only `src/pages/index.astro` by retaining NOR-137's structural classes and replacing its hardcoded profile data with the NOR-136 content boundary. A source-contract verifier complements the existing HTML marker verifier; rendering remains Astro prerendered HTML.

**Tech Stack:** Astro 7, TypeScript strict, Content Collections, Vitest, Tailwind CSS.

## Global Constraints

- Consume profile only through `getProfile()` and experiences only through `getVisibleExperiences()`.
- Never render or infer entries where `visible: false`; do not call `getCollection('experience')` from the home page.
- Preserve the Canvas-free NOR-137 home and its `about-heading`, `stack-heading`, `portfolio-heading`, and `recent-posts-heading` markers.
- Preserve `buildPersonJsonLd('https://gze1206.net/')` and static prerendering.
- Do not deploy, authenticate against GitHub/Cloudflare, or add credentials.

---

### Task 1: Integrate CMS content with the portfolio home

**Files:**

- Modify: `src/pages/index.astro`
- Create: `scripts/verify-home-cms-integration.mjs`, `scripts/verify-home-cms-integration.test.ts`
- Verify: existing `scripts/verify-home-layout.mjs`, `src/lib/experience.test.ts`

**Interfaces:**

- Consumes: `getProfile(): Promise<CollectionEntry<'profile'>>` and
  `getVisibleExperiences(): Promise<CollectionEntry<'experience'>[]>`.
- Produces: a home whose hero uses `profile.data` and whose optional experience section only receives
  the filtered `experiences` array.

- [ ] **Step 1: Merge the prerequisite feature branches without committing a conflict marker**

Run from the NOR-138 worktree:

```bash
git merge --no-ff feature/nor-136-profile-career
git merge --no-ff feature/nor-137-layout-taxonomy
```

Expected: the second merge conflicts only in `src/pages/index.astro`; retain NOR-137 section classes and
headings as the final presentation surface, then leave the worktree ready for the TDD steps below.

- [ ] **Step 2: Write the failing source-contract test**

Create `scripts/verify-home-cms-integration.test.ts` with a fixture that omits
`getVisibleExperiences`, then assert:

```ts
expect(verifyHomeCmsIntegration(source)).toEqual([
  'home must load visible experiences through getVisibleExperiences',
]);
```

Run: `pnpm test scripts/verify-home-cms-integration.test.ts`

Expected: FAIL because the verifier does not exist.

- [ ] **Step 3: Add the minimal verifier and make the real home fail before integration**

Create `scripts/verify-home-cms-integration.mjs` with these required source fragments:

```js
const REQUIRED_FRAGMENTS = [
  ['getProfile', 'home must load profile through getProfile'],
  ['getVisibleExperiences', 'home must load visible experiences through getVisibleExperiences'],
  ['profile.data.name', 'home must render the profile name'],
  ['profile.data.headline', 'home must render the profile headline'],
  ['profile.data.introduction', 'home must render the profile introduction'],
  ['profile.data.skills.map', 'home must render CMS skills'],
  ['experiences.length > 0', 'home must hide an empty experience section'],
];
```

Return all messages whose fragments are absent and append
`home must not read experience collections directly` when the source includes
`getCollection('experience')`. Add a test that reads `src/pages/index.astro`; it must fail before the
page uses CMS data.

- [ ] **Step 4: Resolve the home conflict with CMS data at the existing presentation points**

Use this data-loading shape:

```astro
const [allPosts, portfolio, profile, experiences] = await Promise.all([ getVisiblePosts(),
getCollection('portfolio'), getProfile(), getVisibleExperiences(), ]);
```

Replace NOR-137's hardcoded eyebrow, title, lede, summary, and technology array with profile fields.
Render `experiences` only when `experiences.length > 0`, preserving the `experience-heading` and
NOR-137's `home-detail*` classes. Keep `buildPersonJsonLd('https://gze1206.net/')`, project cards,
recent posts, and all four required heading IDs unchanged. Do not import `InteractiveCanvas`.

- [ ] **Step 5: Run focused checks and commit**

Run:

```bash
pnpm test scripts/verify-home-cms-integration.test.ts scripts/verify-home-layout.test.ts src/lib/experience.test.ts
pnpm lint
pnpm format:check
pnpm build
```

Expected: tests pass; the built home is Canvas-free and retains the four heading markers.

```bash
git add src/pages/index.astro scripts/verify-home-cms-integration.mjs scripts/verify-home-cms-integration.test.ts
git commit -m "✨ feat(home): CMS 소개와 경력을 포트폴리오 홈에 연결 (NOR-138)"
```

## Plan self-review

- **Spec coverage:** Task 1 resolves the known merge collision, uses the profile and visible-experience
  boundaries, preserves marker/JSON-LD/static constraints, and verifies the privacy boundary through the
  existing selector test.
- **Placeholder scan:** every implementation step names the required paths, source fragments, command,
  and expected result; no external configuration is deferred as code work.
- **Type consistency:** `getProfile()` and `getVisibleExperiences()` match the existing NOR-136 exports;
  `profile`, `experiences`, and their `data` fields are the names consumed in the Astro template.
