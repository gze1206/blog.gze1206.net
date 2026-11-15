# 블로그 체계적 개선 (NOR-197) Implementation Plan

> **For agentic workers:** Task 단위로 진행한다. 각 Task 는 명세 AC 에 연결된 red 커밋 → green 커밋(→ 필요하면 refactor 커밋)으로 끝난다.

**Goal:** 프로덕션 산출물에서 draft 를 없애고, 빌드 경고를 0으로, 블로그 TS 를 저장소 기준만큼 엄격하게, `src/lib` 를 죽은 코드 없이, e2e 를 주요 페이지 전체로 넓힌다. Vitest 5·pnpm 12 로 올린다.

**명세:** [`docs/spec/blog/NOR-197-blog-hardening.md`](../../spec/blog/NOR-197-blog-hardening.md) (AC-1 ~ AC-14)

## Global Constraints

- 브랜치 `feat/nor-197-blog-hardening` (base `v4`). 커밋 `<gitmoji> type(scope): 요약 (NOR-197)`. 테스트 커밋 `✅ test(...)`.
- trailer 는 마지막 한 단락: `-m $'TDD: red\nSpec: NOR-197 AC-n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'`. red 는 테스트만 담고, 실패는 **단언 실패 또는 모듈 없음**이어야 한다(없는 export 호출로 TypeError 금지: 새 모듈에 두거나 `toHaveProperty` 를 먼저 단언). 처음부터 통과하는 보호 테스트는 `TDD: regression`.
- 테스트 이름 `NOR-197 AC-n: …`. green 뒤 `pnpm tdd:evidence --base v4`. Task 끝마다 `pnpm verify`(spec:check 는 남은 AC 때문에 실패할 수 있다. 그 앞 단계는 통과).
- **공개 글 산출물 불변:** Task 1~5 는 draft 가 아닌 공개 글 4편의 `dist/blog/<slug>/index.html` 본문을 바꾸지 않는다. 비교는 `astro-island` uid 와 `/_astro/` 해시를 정규화한 뒤 한다(1b 와 같은 방법). 메타 태그(`og:image`)·CSS 참조 변화는 해당 AC 의 의도된 변화다.
- 공개 저장소: 개인 정보(Tailnet 도메인·IP·호스트명·이메일·로컬 절대 경로)를 쓰지 않는다. 새 의존성은 catalog, `minimum-release-age=1440`.

## Task 0: 준비

- [ ] 명세와 계획 커밋 `📝 docs(blog): 블로그 체계적 개선 명세·계획을 쓴다 (NOR-197)`.

## Task 1: 산출물 감사와 smoke 분리 (AC-1, AC-2, AC-3)

**Files:** Create `apps/blog/src/lib/dist-audit.ts`(+ test), `apps/blog/scripts/audit-dist.ts`. Modify `apps/blog/package.json`(postbuild 에 감사 추가), `apps/blog/src/pages/smoke/*.astro`, `apps/blog/src/lib/feed.ts`(+ test), `apps/blog/src/pages/smoke/media.astro`(main-content), `apps/blog/scripts/verify-static-build.mjs`(감사로 대체 후 삭제).

**Produces:**

```ts
// lib/dist-audit.ts — 순수 함수. 파일 입출력은 scripts/audit-dist.ts 가 한다.
export interface DistFile {
  path: string;
  html: string;
} // dist 기준 상대 경로
export interface AuditInput {
  files: readonly DistFile[];
  draftSlugs: readonly string[];
  draftTitles: readonly string[];
  smoke: boolean;
}
export interface AuditFinding {
  rule: string;
  path: string;
  detail: string;
}
export function auditDist(input: AuditInput): AuditFinding[];
export const SMOKE_ENABLED: boolean; // import.meta.env.DEV || process.env.BLOG_SMOKE === '1' 를 감싼 함수 isSmokeEnabled(env) 로 테스트
export function isSmokeEnabled(env: { DEV?: boolean; BLOG_SMOKE?: string }): boolean;
```

- 규칙(1단계): `smoke-in-production`(smoke=false 인데 `smoke/` 경로가 있음), `draft-leak`(smoke=false 인데 HTML 에 draft slug 경로 `/blog/<slug>` 나 draft 제목이 있음). Task 3 에서 규칙을 더한다.
- smoke 페이지는 정적 라우트를 `src/pages/smoke/[page].astro` 하나로 합치고 `getStaticPaths` 가 `isSmokeEnabled` 가 거짓이면 `[]` 를 돌려준다. 페이지별 본문은 지금 파일의 마크업을 컴포넌트(`src/components/smoke/*.astro`)로 옮긴다. 각 페이지에 `main#main-content`.
- `audit-dist.ts` 는 `dist/**/*.html` 을 읽고, draft 목록은 `src/content/posts/*.mdoc|md` frontmatter 에서 얻는다(블로그의 `postSchema` 로 파싱). 발견이 있으면 목록을 찍고 exit 1.
- `feed.ts` 의 draft 필터를 없애고, 이미 거른 목록을 받는다는 것을 타입/주석으로 밝힌다.

**Tests:** `NOR-197 AC-1: 프로덕션 감사는 smoke 경로와 draft slug·제목을 찾는다`, `NOR-197 AC-2: isSmokeEnabled 는 DEV 또는 BLOG_SMOKE=1 일 때만 참이다`, `NOR-197 AC-3: feed 는 draft 를 따로 거르지 않고 받은 순서를 지킨다`(행동: draft 가 섞인 입력을 그대로 항목으로 만든다).

**Verify:** `pnpm --filter @gze1206/blog build` 가 감사를 통과하고 `dist/smoke` 가 없다. `BLOG_SMOKE=1 pnpm --filter @gze1206/blog build` 는 smoke 6쪽을 만든다(감사는 smoke=true 로 돈다). 1b 계획의 AC-17 확인 방법(`dist/smoke/...` grep)은 `BLOG_SMOKE=1` 빌드로 한다는 한 줄을 1b 계획 문서에 덧붙인다.

## Task 2: 빌드 경고 0 (AC-4, AC-5, AC-6)

**Files:** Modify `apps/blog/src/lib/og-targets.ts`(+ test), `apps/blog/astro.config.mjs`(redirects 제거, `vite.build.chunkSizeWarningLimit`), Create `apps/blog/public/_redirects`, Modify `apps/blog/markdoc.config.mjs`(plaintext 판정을 함수로 빼서 `src/lib/code-lang.ts`(+ test)), `apps/blog/src/lib/dist-audit.ts`(규칙 추가).

- og: `buildOgTargets` 에 `/about`(`kind: 'about'` 템플릿), `/books`, `/portfolio` 를 더한다. 감사 규칙 `missing-og-image`: HTML 의 `og:image` 가 사이트 주소의 `/og/...png` 이면 `dist/og/...png` 가 있어야 한다.
- `_redirects`: `/career /about 301`. 감사 규칙 `meta-refresh`: `<meta http-equiv="refresh"` 가 있는 HTML 은 실패.
- `code-lang.ts`: `isLoadedLanguage(lang, loaded)` 는 shiki 특수 언어(`plaintext`, `text`, `txt`, `plain`, `ansi`)를 로드된 것으로 본다.
- `chunkSizeWarningLimit`: Mermaid 파서 청크 크기(약 650 kB)를 넘는 값(예: 700)으로 두고, 그 근거(동적 import, AC-7 감사)를 주석에 쓴다.

**Tests:** `NOR-197 AC-5: …`(og 대상에 세 경로, 감사가 없는 og 이미지를 찾음), `NOR-197 AC-6: …`(`_redirects` 내용 파싱 테스트, 감사가 meta refresh 를 찾음), `NOR-197 AC-4: plaintext 와 shiki 특수 언어는 로드된 언어로 본다`.

**Verify (AC-4):** 프로덕션 빌드 로그를 파일로 남겨 네 경고 문자열이 0건인지 grep 한다.

## Task 3: 무거운 자원은 필요한 페이지에만 (AC-7)

**Files:** Modify `apps/blog/src/layouts/BaseLayout.astro`(KaTeX CSS import 제거), `src/components/markdoc/Math.astro`·`MathBlock.astro`(CSS import), `.md` 수식(`rehype-katex`) 경로에도 CSS 가 붙게 하는 방법(레이아웃이 글의 수식 여부를 알면 조건부 import, 아니면 PostLayout 에서 본문에 `.katex` 가 있을 때), `src/lib/dist-audit.ts`(규칙 `heavy-asset`).

- 감사 규칙 `heavy-asset`: HTML 에 `data-language="mermaid"` 블록이 없는데 Mermaid 계열 청크(`mermaid`, `mermaid-parser`, `cytoscape`, 큰 `chunk-*` 중 Mermaid 가 import 하는 것)를 `<script>`·`modulepreload` 로 참조하면 실패. 수식(`class="katex"`)이 없는데 KaTeX CSS 를 참조하면 실패, 있는데 참조하지 않으면 실패. 청크 판별은 `dist/_astro` 의 파일 이름 패턴과 파일 내용 표지(예: `langium`)를 함께 쓴다.

**Tests:** `NOR-197 AC-7: …` 감사 규칙 단위 테스트(fixture HTML).

## Task 4: 엄격 TS (AC-8)

**Files:** Modify `apps/blog/tsconfig.json`(두 옵션, `baseUrl` 제거 후 `paths` 를 상대 경로로, `exclude: ["dist", "coverage", ".astro"]`), 오류 3건과 astro check 가 새로 내는 오류를 고친다.

- 고칠 때 `!` 단언이나 `as` 로 덮지 않는다. 값이 없을 수 있으면 타입을 `T | undefined` 로 정직하게 쓰거나 분기한다.
- `tsconfig.json` 에 주석으로 "저장소 기준(`packages/config/tsconfig.base.json`)과 같은 엄격 옵션" 이라고 적는다.

**Tests:** `NOR-197 AC-8: 블로그 tsconfig 는 저장소 기준의 엄격 옵션을 켜고 baseUrl 이 없다`(tsconfig 를 JSONC 로 읽는 단위 테스트, 위치 `apps/blog/src/lib/tsconfig.test.ts` 대신 `apps/blog/config.test.ts`).

## Task 5: `src/lib` 정리 (AC-9, AC-10)

**Files:** Create `packages/repo-tools/src/dead-exports/*.ts`(+ test), `packages/repo-tools/src/cli/dead-exports.ts`, 루트 `package.json` scripts `dead-exports`(verify 에 포함). Delete `apps/blog/src/lib/legacy-post-migration.ts`(+ test). Modify `apps/blog/src/lib/content.ts`(죽은 export 제거), 내부 전용 export 의 `export` 제거. Create `apps/blog/src/lib/taxonomy-list.ts`, `portfolio.ts`, `book-labels.ts`(각 + test). Modify `topics.astro`, `portfolio.astro`, `books.astro`.

**Produces:**

```ts
// repo-tools/src/dead-exports/find.ts
export interface DeadExport {
  file: string;
  name: string;
}
/** dir 아래 .ts/.tsx 의 export 중, 테스트 파일이 아닌 다른 소스 파일(.ts/.tsx/.astro/.mjs)이 import 하지 않는 것. */
export function findDeadExports(input: {
  files: ReadonlyMap<string, string>;
  targetDir: string;
}): DeadExport[];
```

- import 해석: 상대 경로와 tsconfig `paths` 별칭(`@/` 등 블로그가 실제로 쓰는 것). `.astro` frontmatter 의 import 도 읽는다. 네임스페이스 import(`import * as x`)는 그 모듈의 export 전체를 쓴 것으로 본다. `export type` 도 대상이다.
- 대상 디렉터리는 `apps/blog/src/lib`. 블로그 바깥 패키지는 보지 않는다.

**Tests:** `NOR-197 AC-9: …`(find 단위 테스트: 쓰이는 export, 테스트만 쓰는 export, 네임스페이스 import, .astro import, 별칭), `NOR-197 AC-10: …`(세 lib 함수 단위 테스트).

## Task 6: e2e 확장 (AC-11, AC-12)

**Files:** Create `apps/blog/e2e/{taxonomy,pages,search,theme,feed}.spec.ts`, `apps/blog/e2e/smoke-render.spec.ts`. Modify `apps/blog/playwright.config.ts`(프로젝트 둘: `production`(기본 빌드), `smoke`(`BLOG_SMOKE=1` 빌드, 다른 포트, `smoke-render.spec.ts` 만)).

- 각 테스트는 실제 콘텐츠에서 대상을 고른다(예: 첫 시리즈, 첫 태그). 콘텐츠가 바뀌어도 깨지지 않게 이름을 하드코딩하지 않는다. 단, 검색어는 공개 글 제목의 한 단어를 페이지에서 읽어 쓴다.
- 테마 토글: 바꾼 뒤 새로고침해도 유지되는지.
- RSS: `content-type` 이 XML 이고 `<item>` 수가 공개 글 수와 같다.
- 404: 본문에 안내 문구와 홈 링크.

**Tests:** 테스트 이름은 `NOR-197 AC-11: …`, `NOR-197 AC-12: …`. CI 의 e2e job 이 두 프로젝트를 모두 돈다.

## Task 7: 의존성과 문서 (AC-13, AC-14)

**Files:** `pnpm-workspace.yaml`(catalog: vitest·@vitest/coverage-v8 5.1.x), 루트 `package.json`(`packageManager: pnpm@12.18.x`, engines), `mise.toml`(pnpm), `apps/workbench/Dockerfile`(packageManager 를 읽으므로 확인만), `.github/workflows/*`(mise 가 읽으므로 확인), `pnpm-lock.yaml`, `docs/release-readiness.md`, `docs/conventions/coding.md`(Vitest·pnpm 버전 서술).

- Vitest 5 마이그레이션 가이드를 먼저 읽는다(`npx ctx7@latest` 또는 공식 문서). 설정 변경이 필요하면 각 패키지 `vitest.config.*` 를 고친다.
- pnpm 12 의 lockfile·설정 변경(예: `.npmrc` 키 이름)을 확인한다. `pnpm install --frozen-lockfile` 이 깨끗한 상태에서 통과해야 한다.
- 이 Task 는 TDD 대상이 아니다(`🔧 chore` / `⬆️ chore`, trailer `TDD: refactor`).

## Task 8: 마무리

- [ ] `pnpm verify && pnpm e2e && pnpm tdd:evidence --base v4`, 깨끗한 설치에서.
- [ ] Claude·Codex 병렬 보안 검수(읽기 전용). 중점: draft 누출 경로(빌드 변수, 개발 서버 설정이 프로덕션에 새는지), `_redirects`, 감사 스크립트가 산출물을 놓치는 경우, 의존성 업그레이드의 공급망 위험.
- [ ] push, PR(base `v4`), CI 통과 후 병합, Linear NOR-197 Done.
