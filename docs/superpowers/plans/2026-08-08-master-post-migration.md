# Master Post Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the four production Nuxt posts from `master` into the Astro `posts` Content Collection without changing their public slugs.

**Architecture:** Keep Nuxt-to-Markdoc normalization in a pure `src/lib/legacy-post-migration.ts` module, tested directly with Vitest. Apply its fixed rules to the four source Markdown files from `master`, placing the resulting Content Collection entries in `src/content/posts/`. Use the current collection schema as the final data-contract validation.

**Tech Stack:** TypeScript strict, Vitest, Astro Content Collections, Markdoc, pnpm.

## Global Constraints

- Use `master:app/content/articles/*.md` as the only post source; do not use `v3`.
- Preserve original `title`, `slug`, `date`, `category`, and `tags`.
- Set `publishedAt` and `updatedAt` to the original `date`; set `draft: false`.
- Generate descriptions from each post's content; ignore legacy descriptions.
- Remove `<!--more-->`, replace `:br` with paragraph spacing, and convert ````lang[filename]` to ````lang title="filename"`.
- Do not change custom domains, DNS, or redirects.
- Do not create a commit unless the user explicitly asks for one.

---

### Task 1: Test and implement legacy body normalization

**Files:**
- Create: `src/lib/legacy-post-migration.ts`
- Create: `src/lib/legacy-post-migration.test.ts`

**Interfaces:**
- Produces: `normalizeLegacyPostBody(body: string): string`
- Produces: `legacyDateToPostDates(date: string): { publishedAt: string; updatedAt: string }`
- Produces: `assertLegacyPostMetadata(metadata: LegacyPostMetadata): void`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  assertLegacyPostMetadata,
  legacyDateToPostDates,
  normalizeLegacyPostBody,
} from './legacy-post-migration';

describe('normalizeLegacyPostBody', () => {
  it('removes excerpt markers, expands Nuxt line-break tokens, and converts file-name fences', () => {
    expect(normalizeLegacyPostBody('첫 문단\n<!--more-->\n:br\n```ruby[answer.rb]\nputs 1\n```'))
      .toBe('첫 문단\n\n```ruby title="answer.rb"\nputs 1\n```');
  });
});

describe('legacyDateToPostDates', () => {
  it('uses the legacy publication date for both required collection dates', () => {
    expect(legacyDateToPostDates('2021-10-04T21:24:58.938Z')).toEqual({
      publishedAt: '2021-10-04T21:24:58.938Z',
      updatedAt: '2021-10-04T21:24:58.938Z',
    });
  });
});

describe('assertLegacyPostMetadata', () => {
  it('rejects an incomplete legacy article', () => {
    expect(() => assertLegacyPostMetadata({ title: '제목' } as never)).toThrow('slug');
  });
});
```

- [ ] **Step 2: Run the tests to verify the expected failure**

Run: `pnpm test src/lib/legacy-post-migration.test.ts`

Expected: FAIL because `./legacy-post-migration` does not exist.

- [ ] **Step 3: Implement the smallest typed converter**

```ts
export interface LegacyPostMetadata {
  title: string;
  slug: string;
  date: string;
  category: string;
  tags: string[];
}

export function normalizeLegacyPostBody(body: string): string {
  return body
    .replaceAll(/<!--more-->\s*/g, '')
    .replaceAll(/^:br\s*$/gm, '')
    .replaceAll(/```([^\n\[]+)\[([^\]\n]+)]/g, '```$1 title="$2"')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}
```

Add date mapping and required-field validation with explicit errors for `title`, `slug`, `date`, `category`, and an empty `tags` array.

- [ ] **Step 4: Run focused tests to verify green**

Run: `pnpm test src/lib/legacy-post-migration.test.ts`

Expected: PASS.

### Task 2: Add the four migrated posts and their referenced legacy image

**Files:**
- Create: `src/content/posts/baekjoon-15663-n-and-m-9-ruby.md`
- Create: `src/content/posts/baekjoon-solved-50-and-class-5.md`
- Create: `src/content/posts/c-9-0-record-type.md`
- Create: `src/content/posts/new-things-on-this-blog.md`
- Copy: `master:app/static/img/kakaotalk_20211116_122629464.png` → `public/img/kakaotalk_20211116_122629464.png`

**Interfaces:**
- Consumes: source articles at `master:app/content/articles/*.md`
- Consumes: `normalizeLegacyPostBody` transformation rules from Task 1
- Produces: four files satisfying `postSchema` in `src/content/schemas.ts`

- [ ] **Step 1: Extract the source files without checking out `master`**

Run:

```bash
git show master:app/content/articles/baekjoon-15663-n-and-m-9-ruby.md
git show master:app/content/articles/baekjoon-solved-50-and-class-5.md
git show master:app/content/articles/c-9-0-record-type.md
git show master:app/content/articles/new-things-on-this-blog.md
```

- [ ] **Step 2: Create Content Collection frontmatter**

For every file, include the following exact field shape:

```yaml
---
title: <original title>
description: <content-derived Korean summary>
slug: <original slug>
category: <original category>
tags: <original tags>
publishedAt: <original date>
updatedAt: <original date>
draft: false
---
```

- [ ] **Step 3: Copy and normalize each body**

Apply all Task 1 normalization rules. Preserve headings, prose, links, lists, and code content. Do not add a series field.
Replace the legacy `:article-image` component with a standard Markdown image and retain its referenced image under `public/img/`, so the migrated post has no broken asset reference.

- [ ] **Step 4: Inspect the changed files**

Run: `git diff --check && git diff -- src/content/posts`

Expected: four new posts, valid YAML frontmatter, no whitespace errors.

### Task 3: Validate the imported site

**Files:**
- Test: `src/lib/legacy-post-migration.test.ts`
- Validate: `src/content/posts/*.md`

**Interfaces:**
- Consumes: migrated posts and the current Astro Content Collection schema
- Produces: a successful local production build with all migrated routes generated

- [ ] **Step 1: Run all unit tests**

Run: `pnpm test`

Expected: PASS, including the legacy migration tests.

- [ ] **Step 2: Run static checks**

Run: `pnpm lint && pnpm build`

Expected: PASS and generated routes for all four migrated slugs.

- [ ] **Step 3: Confirm the rendered route set**

Run:

```bash
for slug in baekjoon-15663-n-and-m-9-ruby baekjoon-solved-50-and-class-5 c-9-0-record-type new-things-on-this-blog; do
  test -f "dist/blog/$slug/index.html"
done
```

Expected: all four files exist.

- [ ] **Step 4: Review before handoff**

Run: `git diff --check && git status --short`

Expected: only the migration module, test, migrated content, and approved planning documents are changed. Do not commit unless requested by the user.
