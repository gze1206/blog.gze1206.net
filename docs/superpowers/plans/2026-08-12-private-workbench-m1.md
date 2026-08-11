# Private Workbench M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tailnet 전용 개인 서비스에서 Markdown 불렛 노트·템플릿·회고·안전한 public Markdoc 발행을 제공한다.

**Architecture:** 별도 private Git 저장소에 Next.js(Node runtime) 단일 서비스를 만든다. `workspace/` Markdown이 원본이고 Git은 이력만 담당한다. server-only repository 모듈이 파일·Git·public 블로그 clone을 다루며, React UI는 그 API만 사용한다.

**Tech Stack:** Next.js App Router, React, TypeScript strict, Tailwind, Zod, gray-matter, Vitest, Playwright, Git CLI, Tailscale Serve.

## Global Constraints

- 새 저장소는 private이며 public blog 저장소의 서브모듈이 아니다.
- 저장은 원자적 rename으로 수행하고 원본 Markdown을 DB로 복제하지 않는다.
- 자동 이월·자동 회고 문서 생성·자동 push/deploy를 만들지 않는다.
- public 변환은 private 링크/자산을 거부하고, public worktree가 깨끗할 때만 시작한다.

---

### Task 1: 저장소·파일 계약·템플릿 코어 (NOR-143)

**Files:** Create `src/domain/{document,template}/**`, `src/server/{workspace,git}/**`, `workspace/templates/*.md`, `src/app/{page.tsx,api/documents/route.ts}` and matching `*.test.ts`.

- [ ] **Step 1: Scaffold the private repository with strict TypeScript and test commands**

Create a private `personal-workbench` repository. Add `test`, `lint`, `format:check`, `build`, and `e2e` scripts. Configure `WORKSPACE_ROOT` and `PUBLIC_BLOG_ROOT` as server-only environment variables; reject paths outside their resolved roots.

- [ ] **Step 2: Write failing parser tests for template frontmatter**

```ts
expect(parseTemplate(source)).toMatchObject({
  kind: 'weekly-review',
  defaultPath: 'reviews/weekly',
  publicEligible: false,
});
expect(() => parseTemplate('---\nkind: nope\n---')).toThrow('unsupported template kind');
```

- [ ] **Step 3: Implement `Template`, `Document`, and atomic file repository boundaries**

Expose `listTemplates()`, `createFromTemplate(input)`, `readDocument(path)`, and `writeDocument(path, source)`; write to a same-directory temp file and `rename`, never a database. Include the five agreed templates.

- [ ] **Step 4: Add the initial calm document UI**

Provide template gallery, document list, and Markdown editor. The UI must call `/api/documents` and never receive raw filesystem paths not validated by the server.

- [ ] **Step 5: Test and commit**

Run `pnpm test src/domain src/server && pnpm lint && pnpm build`; commit `✨ feat(workbench): 파일 기반 템플릿과 문서 코어 추가 (NOR-143)`.

### Task 2: 일일 불렛·의도적 이월 (NOR-144)

**Files:** Create `src/domain/bullets/{syntax,parse,migrate}.ts`, tests, `src/app/day/[date]/page.tsx`, `src/components/{QuickCapture,MigrateDialog}.tsx`.

- [ ] **Step 1: Freeze a Git-friendly bullet syntax in failing tests**

```md
- [ ] □ 공개 글 초안 정리 <!-- wb:id=01HX -->
- • 배포 메모 <!-- wb:id=01HY -->
```

Assert dates never create a copy implicitly; a migration creates `<!-- wb:migrated-from=01HX -->` only after an explicit action.

- [ ] **Step 2: Implement parser, status mutation, and two migration policies**

`migrateBullet({ sourceId, targetDate, mode: 'quick' | 'intentional', confirmation })` rejects missing confirmation for intentional mode and always writes a new target line plus immutable source history.

- [ ] **Step 3: Build keyboard-first daily UI**

Default to today, support `•`, `–`, `○`, `□` shortcut insertion, and present old open tasks only in a review panel. Quick migration is select → date → confirm; intentional migration additionally requires the configured phrase.

- [ ] **Step 4: Verify and commit**

Run unit tests for parsing/migration plus Playwright tests for no automatic carry-over and both dialogs; commit `✨ feat(workbench): 의도적 불렛 이월 흐름 추가 (NOR-144)`.

### Task 3: 회고 템플릿과 제안 (NOR-145)

**Files:** Create `src/domain/reviews/{period,suggestion}.ts`, tests, `src/components/ReviewPrompt.tsx`, API routes.

- [ ] **Step 1: Test period calculation and app-open-only suggestions**

`getReviewSuggestion(now, documents)` returns one weekly/monthly candidate only when the period is complete and its review file does not exist; it must not write a file.

- [ ] **Step 2: Implement create/later/skip persistence**

`create` calls `createFromTemplate`; `later` stores a local preference; `skip` suppresses only that period. Manual template creation accepts a past period.

- [ ] **Step 3: Add a restrained prompt and review links**

Show one non-modal prompt after the daily log loads. Never use push notifications or repeated blocking modal dialogs. Allow inserting links to selected bullets and drafts.

- [ ] **Step 4: Test and commit**

Run domain/API/UI tests; commit `✨ feat(workbench): 템플릿 기반 주월 회고 추가 (NOR-145)`.

### Task 4: 안전한 public Markdoc 발행 (NOR-146)

**Files:** Create `src/domain/publishing/{validate,transform,preview,publish}.ts`, tests, `src/app/publish/[path]/page.tsx`, `src/components/PublishReview.tsx`.

- [ ] **Step 1: Test leak detection and dry-run first**

Reject `file://`, `workspace/`, `assets/private/`, and configured private root paths. Assert dry-run returns a unified diff and changes neither the public worktree nor its Git status.

- [ ] **Step 2: Implement deterministic Markdoc transform**

Map approved frontmatter to the blog `postSchema`, copy only allowlisted assets to public staging, and validate the generated `.mdoc` before Git operations.

- [ ] **Step 3: Implement review then explicit commit**

Require clean public worktree, show title/slug/category/tags/date/assets/diff, then require `confirmPublish: true`. Create a `content/<slug>` branch and commit only after confirmation; never push.

- [ ] **Step 4: Test and commit**

Use temporary Git repositories in tests for dirty-worktree, rejected leak, dry-run, and confirmed branch commit; commit `✨ feat(workbench): 검토형 Markdoc 발행 추가 (NOR-146)`.

### Task 5: Tailnet 운영 경계 (NOR-147)

**Files:** Create `docs/operations/tailnet-workbench.md`, `.env.example`, `docker-compose.yml`, `Dockerfile` and healthcheck test/script.

- [ ] **Step 1: Document non-public deployment before host changes**

Specify a dedicated non-root service account, private repo read/write key, read-only public clone credentials except publishing path, backup/restore commands, and Tailscale Serve limited to the tailnet.

- [ ] **Step 2: Provide container health endpoint and configuration validation**

`GET /api/health` reports no secret values. Startup rejects missing roots, equal private/public roots, or writable directories outside configured roots.

- [ ] **Step 3: Validate locally and commit**

Run container build, healthcheck, unit/e2e suite. Commit `🔒 docs(workbench): Tailnet 전용 운영 경계 기록 (NOR-147)`. Do not apply Serve/ACL or deploy to the personal server without the user's final external-operation approval.

## Final verification

- [ ] Private repo contains no public deployment secrets; public blog repo contains no private source or asset paths.
- [ ] `pnpm test && pnpm lint && pnpm format:check && pnpm build && pnpm e2e` pass.
- [ ] Manual keyboard capture, both migration modes, missed monthly review, rejected leak, accepted dry-run, and confirmed no-push publish flows pass.
