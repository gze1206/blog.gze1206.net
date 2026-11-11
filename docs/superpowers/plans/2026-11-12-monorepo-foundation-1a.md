# 모노레포 기반 (하위 프로젝트 1a) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 블로그 저장소를 `apps/blog` + `apps/workbench` + `packages/*` pnpm 모노레포로 바꾸고, 발행 계약을 `@gze1206/content-contract` 하나로 단일화하며, red→green 을 CI 가 검증하게 만든다.

**Architecture:** 블로그는 `git mv` 로 옮겨 이력을 잇고, 워크벤치는 private 저장소 커밋 `8453402` 의 스냅샷을 공개 전 검수 후 들인다. 공용 규칙(경계·명세·TDD 증거)은 `packages/repo-tools` 의 순수 함수 + 얇은 CLI 로 만들고, 글 스키마는 `packages/content-contract` 로 옮겨 두 앱이 import 한다.

**Tech Stack:** pnpm 11 workspace + catalog, Node 26, TypeScript 6.0.3, Astro 7, Vite 8, Hono, zod 4, Vitest 4, Playwright, GitHub Actions(`ubuntu-24.04-arm` 포함), Docker buildx.

설계 문서: [`../specs/2026-11-12-monorepo-foundation-design.md`](../specs/2026-11-12-monorepo-foundation-design.md)

## Global Constraints

- **`NOR-195`** 는 Task 0 에서 만든 Linear 일감 번호다. 이 문서의 `NOR-195` 를 전부 그 번호로 바꿔 쓴다(파일명·테스트 이름·커밋 포함).
- Node `26`, pnpm `11.15.0`(`packageManager`), TypeScript `6.0.3` 고정. TypeScript 7 은 `typescript-eslint`(`<6.1.0`)·`@astrojs/check`(`^5 || ^6`)가 지원하지 않으므로 쓰지 않는다.
- Vitest 는 4.x 를 유지한다(5.x 업그레이드는 하위 프로젝트 2).
- 패키지 이름: `@gze1206/blog`, `@gze1206/workbench`, `@gze1206/content-contract`, `@gze1206/config`, `@gze1206/repo-tools`. 모두 `"private": true`.
- 의존 방향: `apps/*` → `packages/*` 만. 앱끼리, 패키지→앱 import 금지.
- 커밋: `<gitmoji> <type>(<scope>): <한국어 요약> (NOR-195)` + 필요 시 `TDD: red|green|refactor|regression` 과 `Spec: NOR-195 AC-n` trailer + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- red 커밋은 **테스트 실패를 직접 실행해 확인한 뒤** 만든다. 처음부터 통과하는 테스트는 `TDD: regression`.
- 공개 저장소로 push·저장소 archive·GHCR 권한·ruleset·Linear 생성은 **실행 직전 사용자 확인**.
- 이 계획은 블로그 동작을 바꾸지 않는다. Task 3 의 이동은 경로에서 나오는 해시(아일랜드 `uid`, 이미지 변환 파일명)를 바꾸고, Tailwind 자동 소스 감지 범위를 저장소 루트에서 `apps/blog` 로 좁혀 블로그가 쓰지 않는 `.contents`·`.outline` 유틸리티 2개를 뺀다. 이 차이는 경로 해시를 정규화하면 0 이다(2026-11-12 확인). 그래서 Task 3 이후의 바이트 비교 기준선은 `$BASE/post-move.sha` 다.
- 공개 문서에 Tailnet 도메인·Tailscale IP·호스트명·개인 이메일·로컬 절대 경로를 남기지 않는다.
- 셸을 새로 열 때마다 아래 두 줄을 먼저 실행한다. Task 2 이후의 바이트 비교가 이것을 쓴다.

  ```bash
  BASE=/private/tmp/claude-501/-Users-myoungsikkim-work-blog-gze1206-net/2b043d48-25d6-4801-ab09-a476bbb25d2e/scratchpad/baseline
  hashdist() { (cd "$1" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256); }
  ```

### 설계와 달라진 점 (계획 단계에서 확정)

| 설계                                        | 계획                                           | 이유                                                                                                                                                                                                   |
| ------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 루트 `vitest.config.ts` 의 `test.projects`  | 루트 `pnpm test` = `pnpm -r --if-present test` | 블로그가 `process.cwd()` 기준 경로를 쓴다(`src/lib/og-render.ts:51`, `scripts/verify-mdoc-migration.test.ts:6`). 루트에서 돌리면 cwd 가 바뀌어 깨진다. 패키지별 실행은 `tdd-evidence` 와도 같은 단위다 |
| ESLint `no-restricted-imports` 로 경계 강제 | `repo-tools` 의 경계 검사기(`pnpm boundaries`) | `regex` 패턴은 import 문자열만 보므로 `../../../workbench` 같은 깊이를 판단할 수 없다. 경로를 실제로 풀어 보는 검사가 필요하다                                                                         |
| `BLOG_LAYOUT.postAssetsDir(slug)`           | `BLOG_LAYOUT.publicDir`                        | 워크벤치는 자산을 URL 경로(`assets/posts/<slug>/…`)로 다루고 파일 위치만 `public/` 접두사로 만든다(`publicBlog.ts:219,247,316,327`). 바뀌는 것은 접두사 하나다                                         |
| —                                           | 책 관련 스키마는 1b                            | 설계 문서의 1a/1b 분할                                                                                                                                                                                 |

## 파일 구조 (완료 시점)

```text
/                              package.json(루트 스크립트), pnpm-workspace.yaml(+catalog), mise.toml,
                               .npmrc, .prettierrc, .prettierignore, .editorconfig, .gitignore,
                               .dockerignore, AGENTS.md, CLAUDE.md, README.md
apps/blog/                     (기존 루트의 블로그: src, public, scripts, astro/markdoc/eslint/tsconfig,
                               components.json, wrangler.jsonc, package.json)
apps/workbench/                (스냅샷: src, e2e, test, workspace-seed, deploy, Dockerfile, tsup.config.ts …)
packages/config/               tsconfig.base.json, eslint.js, package.json
packages/repo-tools/src/       boundaries.ts, spec-check.ts, tdd/{trailers,plan,classify,run}.ts, cli/*.ts
packages/content-contract/src/ slug.ts, post.ts, series.ts, layout.ts, index.ts (+ *.test.ts)
docs/spec/repo/NOR-195-monorepo-foundation.md
docs/spec/blog/                (기존 docs/spec/NOR-*.md 이동)
docs/spec/workbench/           (워크벤치 spec·specs 이동)
docs/operations/workbench/     (워크벤치 운영 문서, 검수 후)
docs/decisions/0017-…          (ADR)
.github/workflows/ci.yml, workbench-image.yml
```

---

### Task 0: 준비

**Files:** 없음 (외부 조치와 로컬 도구)

- [ ] **Step 1: Linear 일감 생성 (사용자 확인 후)**

사용자에게 "Linear 팀 `NOR` 에 '모노레포 기반 (하위 프로젝트 1a)' 일감을 만들어도 되는지" 확인한다. 승인되면 `orca linear --help` 로 생성 명령을 확인해 만들고, 받은 번호를 `NOR-195` 로 쓴다.

- [ ] **Step 2: 작업 브랜치**

```bash
cd "$(git rev-parse --show-toplevel)"
git switch docs/monorepo-foundation-design
git switch -c feat/nor-195-monorepo-foundation
```

설계·계획 문서 커밋을 포함한 채 시작한다. PR base 는 `v4`.

- [ ] **Step 3: 도구 준비**

```bash
brew install gitleaks
gitleaks version            # 8.x 출력
open -a OrbStack && sleep 5 && docker version --format '{{.Server.Arch}}'   # arm64
node -v                      # v26.x
```

---

### Task 1: 명세 (SDD)

**Files:**

- Create: `docs/spec/repo/NOR-195-monorepo-foundation.md`

- [ ] **Step 1: spec 작성**

```markdown
# NOR-195 — 모노레포 기반 (하위 프로젝트 1a)

- 설계: [../../superpowers/specs/2026-11-12-monorepo-foundation-design.md](../../superpowers/specs/2026-11-12-monorepo-foundation-design.md)
- 계획: [../../superpowers/plans/2026-11-12-monorepo-foundation-1a.md](../../superpowers/plans/2026-11-12-monorepo-foundation-1a.md)

## 수용 기준

- **AC-1** 경계 검사기는 패키지 디렉터리를 벗어나는 상대 import 와 `apps/*` 패키지 이름 import 를 위반으로 보고하고, 패키지 안의 상대 import 와 `packages/*` 이름 import 는 허용한다.
- **AC-2** `spec:check` 는 수용 기준(AC) 중 어떤 테스트 이름에도 `NOR-N AC-n` 으로 연결되지 않은 것을 보고한다. `(manual)` 표시가 있는 AC 는 제외한다.
- **AC-3** `tdd-evidence` 는 `TDD: red` 커밋이 바꾼 테스트가 단언 실패나 모듈 없음으로 실패하면 red 로 인정하고, 통과하거나 문법·변환 오류로 실패하면 거부한다. 이어지는 `TDD: green` 커밋에서 같은 테스트가 통과해야 한다.
- **AC-4** `postSchema` 는 `toc` 로 `auto`·`inline`·`floating`·`false` 만 받고 기본값은 `auto` 다. series 와 seriesOrder 는 함께 있어야 한다. 빈 문자열 제목과 대문자 slug 를 거부한다. `strictPostSchema` 는 같은 규칙에 더해 모르는 키를 거부한다. `POST_FIELD_ORDER` 는 스키마의 모든 키를 정확히 한 번씩 담는다.
- **AC-5** 블로그의 `postSchema`·`seriesSchema` 는 `@gze1206/content-contract` 의 것과 같은 객체다.
- **AC-6** 워크벤치는 초안의 `toc` 를 발행 결과에 남기고, 초안에 `toc` 가 없으면 발행 결과에도 쓰지 않는다.
- **AC-7** 워크벤치의 발행 경로와 기본 대상 브랜치는 `BLOG_LAYOUT` 에서 온다. `BLOG_LAYOUT` 의 경로는 실제 블로그 디렉터리를 가리킨다.
- **AC-8** 워크벤치 변환 결과를 블로그 `postSchema` 로 다시 읽으면 같은 값이다.
- **AC-9** 블로그의 모든 글 frontmatter 가 `strictPostSchema` 를 통과한다.
- **AC-10** (manual) 블로그 `dist/` 가 이동 전·계약 적용 후에 기준선과 바이트 단위로 같다.
- **AC-11** (manual) 워크벤치 linux/arm64 이미지가 부팅하고 `/api/health` 가 `{"status":"ready"}` 를 돌려준다.
- **AC-12** (manual) PR 에서 `ci.yml` 의 `verify`·`e2e`·`spec-check`·`tdd-evidence` 가 실행되어 통과한다.
```

- [ ] **Step 2: 커밋**

```bash
git add docs/spec/repo/NOR-195-monorepo-foundation.md
git commit -m "📝 docs(infra): 모노레포 기반 수용 기준을 정한다 (NOR-195)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 블로그 산출물 기준선

**Files:** 없음 (저장소 밖 `$BASE` 에 기록)

`$BASE` 는 `/private/tmp/claude-501/-Users-myoungsikkim-work-blog-gze1206-net/2b043d48-25d6-4801-ab09-a476bbb25d2e/scratchpad/baseline` 다.

- [ ] **Step 1: 두 번 빌드해 결정성 확인**

```bash
BASE=/private/tmp/claude-501/-Users-myoungsikkim-work-blog-gze1206-net/2b043d48-25d6-4801-ab09-a476bbb25d2e/scratchpad/baseline
mkdir -p "$BASE"
hashdist() { (cd "$1" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256); }
pnpm install --frozen-lockfile && pnpm build && hashdist dist > "$BASE/pre-a.sha"
rm -rf dist && pnpm build && hashdist dist > "$BASE/pre-b.sha"
diff "$BASE/pre-a.sha" "$BASE/pre-b.sha" && echo DETERMINISTIC
```

Expected: `DETERMINISTIC`. 다르게 나오면 다른 줄의 파일 경로를 `$BASE/nondeterministic.txt` 에 적고, 이후 비교에서는 그 파일을 뺀다(`grep -v -F -f "$BASE/nondeterministic.txt"`). 그 목록은 PR 본문에 남긴다.

- [ ] **Step 2: 테스트 수 기록**

```bash
pnpm test 2>&1 | grep -E "Test Files|Tests " | tee "$BASE/pre-tests.txt"
```

Expected: `Test Files  40 passed (40)` / `Tests  388 passed (388)`.

---

### Task 3: 블로그를 `apps/blog` 로 옮기고 워크스페이스 골격을 만든다

**Files:**

- Move: 루트의 `src public scripts astro.config.mjs markdoc.config.mjs eslint.config.mjs tsconfig.json components.json wrangler.jsonc package.json` → `apps/blog/`
- Create: `package.json`(루트), `apps/blog/package.json`(이름 변경)
- Modify: `pnpm-workspace.yaml`, `.gitignore`, `.prettierignore`, `pnpm-lock.yaml`

- [ ] **Step 1: 캐시 정리와 이동**

```bash
rm -rf node_modules dist .astro .wrangler public/pagefind
mkdir -p apps/blog
git mv src public scripts astro.config.mjs markdoc.config.mjs eslint.config.mjs tsconfig.json components.json wrangler.jsonc package.json apps/blog/
```

- [ ] **Step 2: `apps/blog/package.json` 의 이름·엔진 정리**

`name` 을 `"@gze1206/blog"` 로, `engines.node` 를 `">=26"` 으로 바꾼다. 나머지는 그대로 둔다.

- [ ] **Step 3: 루트 `package.json`**

```json
{
  "name": "gze1206-net",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.15.0",
  "engines": { "node": ">=26" },
  "scripts": {
    "dev:blog": "pnpm --filter @gze1206/blog dev",
    "build": "pnpm -r --if-present build",
    "test": "pnpm -r --if-present test",
    "lint": "pnpm -r --if-present lint",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "prettier": "^3.9.5",
    "prettier-plugin-astro": "^0.14.1",
    "prettier-plugin-tailwindcss": "^0.8.1"
  }
}
```

`apps/blog/package.json` 의 devDependencies 에서 `prettier`, `prettier-plugin-astro`, `prettier-plugin-tailwindcss` 를 지우고, `format`·`format:check` 스크립트도 지운다(루트가 맡는다).

- [ ] **Step 4: `pnpm-workspace.yaml`**

```yaml
packages:
  - apps/*
  - packages/*

allowBuilds:
  esbuild: true
  sharp: true
  workerd: true
```

- [ ] **Step 5: ignore 파일 경로 갱신**

`.gitignore` 의 `public/pagefind/` 를 `apps/blog/public/pagefind/` 로 바꾸고, `.prettierignore` 를 열어 루트 기준 경로(`dist`, `public/pagefind` 등)를 `apps/blog/` 접두사 또는 `**/` 패턴으로 바꾼다. `apps/blog/eslint.config.mjs` 의 ignores 는 패키지 기준이므로 그대로 둔다.

- [ ] **Step 6: 설치와 버전 불변 확인**

```bash
pnpm install
pnpm list -r --depth 0 --json > "$BASE/post-move-deps.json"
git diff --stat pnpm-lock.yaml
```

Expected: lockfile 변경은 importer 경로(`.` → `apps/blog`, 루트 importer 추가)뿐이다. `git diff pnpm-lock.yaml | grep '^[-+] *version:'` 이 비어 있어야 한다.

- [ ] **Step 7: 테스트·빌드·바이트 비교**

```bash
pnpm --filter @gze1206/blog test 2>&1 | grep -E "Test Files|Tests "
pnpm --filter @gze1206/blog build
hashdist apps/blog/dist > "$BASE/post-move.sha"
diff "$BASE/pre-a.sha" "$BASE/post-move.sha" && echo IDENTICAL
```

Expected: `40 passed` / `388 passed`, 그리고 `IDENTICAL`. 다르면 다른 파일을 열어 원인(절대 경로가 산출물에 들어갔는지 등)을 고친 뒤 다시 비교한다. 이 단계에서 산출물을 바꾸는 수정은 하지 않는다.

- [ ] **Step 8: lint 와 format**

```bash
pnpm --filter @gze1206/blog lint && pnpm format:check
```

Expected: 둘 다 통과.

- [ ] **Step 9: 커밋 (이동만)**

```bash
git add -A
git status --short | grep -v '^R ' | head      # 이동 외 변경은 package.json·lock·ignore 뿐이어야 한다
git commit -m "♻️ refactor(infra): 블로그를 apps/blog 로 옮긴다 (NOR-195)" \
  -m "파일 이동과 워크스페이스 골격만 담는다. dist 는 이동 전과 바이트 단위로 같다." \
  -m "Spec: NOR-195 AC-10" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 워크벤치 스냅샷과 공개 전 검수

**Files:**

- Create: `apps/workbench/**` (스냅샷), `docs/spec/workbench/**`, `docs/operations/workbench/**`, `docs/superpowers/plans/2026-08-12-workbench-*.md` 등
- Modify: `apps/workbench/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`

- [ ] **Step 1: 스냅샷 추출**

```bash
WB=../personal-workbench  # 워크벤치 원본 checkout 경로
git -C "$WB" cat-file -e 8453402^{commit} && echo OK
mkdir -p apps/workbench
git -C "$WB" archive 8453402 | tar -x -C apps/workbench \
  --exclude='docs/_temp' --exclude='dist' --exclude='test-results' --exclude='.env' --exclude='.github' \
  --exclude='pnpm-lock.yaml' --exclude='pnpm-workspace.yaml' --exclude='.prettierrc.json' --exclude='.prettierignore'
ls apps/workbench
```

Expected: `OK`, 그리고 `Dockerfile docker-compose.yml deploy docs e2e src test workspace-seed …` 가 보인다. `.env.example` 은 포함된다.

- [ ] **Step 2: 문서 재배치**

```bash
mkdir -p docs/spec/blog docs/spec/workbench docs/operations/workbench
git mv docs/spec/NOR-*.md docs/spec/blog/
mv apps/workbench/docs/spec/* apps/workbench/docs/specs/* docs/spec/workbench/
mv apps/workbench/docs/operations/* docs/operations/workbench/
for f in apps/workbench/docs/plans/*.md; do mv "$f" "docs/superpowers/plans/$(basename "$f" .md | sed 's/^\(2026-08-1[23]\)-/\1-workbench-/').md"; done
rmdir -p apps/workbench/docs/* 2>/dev/null; rm -rf apps/workbench/docs
grep -rln "docs/spec/\|docs/specs/\|docs/operations/\|docs/plans/" docs apps/workbench --include='*.md' --include='*.ts' --include='*.yml'
```

마지막 명령이 찾은 파일의 상대 링크를 새 위치에 맞게 고친다. `docs/spec/README.md`·`docs/spec/_template.md` 는 `docs/spec/` 에 남는다(위 `git mv` 는 `NOR-*` 만 옮긴다).

- [ ] **Step 3: `apps/workbench/package.json`**

`name` 을 `"@gze1206/workbench"`, `engines.node` 를 `">=26"` 으로 바꾸고 `packageManager` 필드를 지운다. `format`·`format:check` 스크립트와 `prettier` devDependency 를 지운다(루트가 맡는다). `"files": ["dist", "workspace-seed"]` 를 추가한다(Task 13 의 `pnpm deploy` 가 쓴다).

- [ ] **Step 4: 빌드 허용 목록 병합**

`pnpm-workspace.yaml` 의 `allowBuilds` 에 워크벤치가 쓰던 항목이 모두 있는지 확인한다(원본은 `esbuild: true` 뿐이었다). 이미 있으므로 변경 없음.

- [ ] **Step 5: 설치와 워크벤치 검증**

```bash
pnpm install
pnpm --filter @gze1206/workbench test 2>&1 | grep -E "Test Files|Tests "
pnpm --filter @gze1206/workbench typecheck
pnpm --filter @gze1206/workbench lint
pnpm --filter @gze1206/workbench build
pnpm --filter @gze1206/workbench exec playwright install chromium
pnpm --filter @gze1206/workbench e2e
```

Expected: `29 passed` / `232 passed`, typecheck·lint·build·e2e 통과. 워크벤치 lockfile 을 버렸으므로 의존성이 범위 안에서 새로 풀렸다. 실패하면 `pnpm --filter @gze1206/workbench why <패키지>` 로 원본 lock(`git -C "$WB" show 8453402:pnpm-lock.yaml`)과 버전을 비교하고, 원본 버전을 `pnpm-workspace.yaml` 의 `overrides` 가 아니라 해당 `package.json` 범위에 고정해 맞춘다.

- [ ] **Step 6: 공개 전 검수 — 비밀값**

```bash
gitleaks dir apps/workbench docs --no-banner --redact -v; echo "exit=$?"
```

Expected: `no leaks found`, `exit=0`. 발견되면 해당 값을 지우고 그 값이 실제 비밀이었는지 사용자에게 보고한다(실제 비밀이면 폐기·교체가 필요하다).

- [ ] **Step 7: 공개 전 검수 — 식별 정보**

```bash
grep -rnE '\b100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.[0-9]{1,3}\.[0-9]{1,3}\b|[a-z0-9-]+\.ts\.net\b|/Users/[a-z]|/home/[a-z]|@gmail\.com|mskim|storm|olm-' apps/workbench docs
```

Expected: 출력 없음. `docs/superpowers/specs/2026-11-12-monorepo-foundation-design.md` 와 이 계획의 검색 패턴 설명 줄은 예외다. 그 외 결과는 일반화(예: 실제 호스트명 → `<host>`)한다.

- [ ] **Step 8: 공개 전 검수 — 운영 문서 수동 검토**

`docs/operations/workbench/*.md` 와 `apps/workbench/.env.example`, `apps/workbench/deploy/**` 를 처음부터 끝까지 읽는다. 다음을 확인하고 결과를 `$BASE/audit.md` 에 체크리스트로 적는다(PR 본문에 옮긴다).

- 실제 사용자명·UID 외의 계정 정보, 실제 도메인·터널 ID·digest 외 식별자가 없다.
- 예시 값(`you@example.com`, `sha256:000…`)만 있다.
- 공격 표면을 알려 주는 서술(어느 포트가 어디서 열려 있는지 등)은 일반 원칙 수준이다.

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "🎉 feat(workbench): personal-workbench 스냅샷을 apps/workbench 로 들인다 (NOR-195)" \
  -m "원본: github.com/gze1206/personal-workbench (private) 8453402. 이력은 공개하지 않고 현재 트리만 검수해 가져온다. docs/_temp, dist, test-results, .env 는 제외했다. gitleaks·식별 정보 검색·운영 문서 수동 검토를 통과했다." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 공통 툴체인

**Files:**

- Create: `packages/config/package.json`, `packages/config/tsconfig.base.json`, `packages/config/eslint.js`, `.prettierrc`(루트, 교체)
- Modify: `pnpm-workspace.yaml`(catalog), `mise.toml`, 루트 `package.json`, `apps/blog/{package.json,tsconfig.json,eslint.config.mjs}`, `apps/workbench/{package.json,eslint.config.js,tsconfig.*.json}`
- Create (TS 6 오류 수정): `apps/blog/src/pagefind.d.ts`
- Modify (TS 6 오류 수정): `apps/blog/src/lib/github-repo.test.ts:79,88,98`, `apps/blog/src/lib/open-graph.test.ts:137`, `apps/blog/src/pages/og/[...path].png.ts:89`

- [ ] **Step 1: `mise.toml`**

```toml
[tools]
node = "26"
pnpm = "11.15.0"
```

- [ ] **Step 2: catalog**

`pnpm-workspace.yaml` 에 추가한다. 값은 두 앱이 현재 쓰는 범위 중 높은 쪽이다.

```yaml
catalog:
  typescript: 6.0.3
  zod: ^4.4.3
  vitest: ^4.1.10
  react: ^19.2.7
  react-dom: ^19.2.7
  '@types/react': ^19.2.17
  '@types/react-dom': ^19.2.3
  tailwindcss: ^4.3.3
  '@tailwindcss/vite': ^4.3.3
  eslint: ^10.7.0
  '@eslint/js': ^10.0.1
  typescript-eslint: ^8.64.0
  eslint-config-prettier: ^10.1.8
  '@types/node': ^24.10.0
  yaml: ^2.8.1
```

두 앱 `package.json` 에서 위 패키지의 버전 문자열을 `"catalog:"` 로 바꾼다. 블로그에는 `typescript`·`zod` 가 아직 없으면 지금 넣지 않는다(타입 검사는 Step 6, zod 는 Task 10).

- [ ] **Step 3: `packages/config`**

`packages/config/package.json`:

```json
{
  "name": "@gze1206/config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { "./tsconfig.base.json": "./tsconfig.base.json", "./eslint": "./eslint.js" },
  "peerDependencies": {
    "@eslint/js": "catalog:",
    "eslint-config-prettier": "catalog:",
    "typescript-eslint": "catalog:"
  }
}
```

`packages/config/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

`packages/config/eslint.js`:

```js
// @ts-check
// 저장소 공통 ESLint 베이스. 앱은 이것을 펼친 뒤 자기 플러그인을 덧붙인다.
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export const base = [
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

/** 포맷 규칙을 끈다. 항상 배열의 마지막에 둔다. */
export const prettierLast = prettier;
```

- [ ] **Step 4: 앱 ESLint 가 베이스를 쓰게 한다**

`apps/blog/eslint.config.mjs` 의 앞 두 줄(`eslint.configs.recommended`, `...tseslint.configs.strict`)과 `no-unused-vars` 규칙 블록을 `...base` 로 대체하고, 맨 끝에 `prettierLast` 를 둔다. `import { base, prettierLast } from '@gze1206/config/eslint';` 를 추가한다.

`apps/workbench/eslint.config.js` 의 `eslint.configs.recommended, ...tseslint.configs.strict,` 를 `...base,` 로, 마지막 `prettier,` 를 `prettierLast,` 로 바꾼다.

두 앱 `devDependencies` 에 `"@gze1206/config": "workspace:*"` 와 `eslint-config-prettier: "catalog:"` 를 넣는다.

- [ ] **Step 5: Prettier 하나로**

루트 `.prettierrc` 를 다음으로 바꾼다. `prettier-plugin-tailwindcss` 를 블로그에만 적용해 워크벤치 클래스 순서가 바뀌지 않게 한다.

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "printWidth": 100,
  "overrides": [
    {
      "files": "apps/blog/**",
      "options": { "plugins": ["prettier-plugin-astro", "prettier-plugin-tailwindcss"] }
    },
    { "files": "*.astro", "options": { "parser": "astro" } }
  ]
}
```

```bash
pnpm install && pnpm format:check
```

Expected: 통과. 워크벤치 파일이 걸리면 `pnpm prettier --write apps/workbench` 후 `git diff --stat apps/workbench` 가 공백 정도의 변경인지 확인한다.

- [ ] **Step 6: TypeScript 6 과 타입 검사 스크립트**

`apps/blog/package.json` devDependencies 에 `"typescript": "catalog:"`, `"@astrojs/check": "0.9.12"`, `"@types/hast": "^3.0.4"` 를 넣고 스크립트 `"typecheck": "astro check"` 를 추가한다.

`apps/blog/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
    // 저장소 기준(packages/config/tsconfig.base.json)의 noUncheckedIndexedAccess·
    // exactOptionalPropertyTypes 는 아직 켜지 않는다. 블로그 코드의 수정은 하위 프로젝트 2 의 일감이다.
  },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`apps/workbench/package.json` 의 `typescript` 를 `"catalog:"` 로 바꾼다(기존 `^6.0.2` → `6.0.3`). 워크벤치의 `typecheck` 스크립트는 그대로 둔다.

```bash
pnpm install
pnpm --filter @gze1206/blog typecheck 2>&1 | tail -4
```

Expected: `8 errors` (기준선). 아래 Step 7 에서 고친다.

- [ ] **Step 7: 블로그 타입 오류 8건 수정**

`apps/blog/src/lib/github-repo.test.ts` 의 세 군데와 `apps/blog/src/lib/open-graph.test.ts` 의 한 군데에서 `vi.fn(async () => …)` 를 `vi.fn<typeof fetch>(async () => …)` 로 바꾼다. 예:

```ts
const spy = vi.fn<typeof fetch>(async () => apiResponse(REPO_PAYLOAD));
```

`apps/blog/src/pages/og/[...path].png.ts:89`:

```ts
  // TS 6 lib 에서 Buffer 의 ArrayBufferLike 는 BodyInit 이 아니다. 복사본은 ArrayBuffer 위에 선다.
  return new Response(new Uint8Array(png), {
```

`SearchPalette.tsx` 의 `/pagefind/pagefind.js` 오류는 **런타임 코드를 바꾸지 않고** 타입 선언으로 푼다. 아일랜드 코드를 바꾸면 JS 청크 해시가 바뀌고, 그 청크를 참조하는 모든 HTML 도 바뀌어 바이트 비교가 무의미해진다. `apps/blog/src/pagefind.d.ts`:

```ts
// Pagefind 는 빌드 뒤(postbuild)에 /pagefind 아래 생기는 모듈이라 타입 검사기가 찾지 못한다.
// 실제 모양은 SearchPalette.tsx 의 PagefindModule 로 좁혀 쓴다.
declare module '/pagefind/pagefind.js' {
  const pagefind: unknown;
  export = pagefind;
}
```

`hast` 오류는 Step 6 의 `@types/hast` 로 풀린다. 나머지 수정은 테스트 파일과 서버 쪽 OG 라우트뿐이라 배포 산출물에 들어가는 코드는 바뀌지 않는다.

```bash
pnpm --filter @gze1206/blog typecheck 2>&1 | tail -4
pnpm --filter @gze1206/blog test 2>&1 | grep -E "Tests "
pnpm --filter @gze1206/blog build && hashdist apps/blog/dist > "$BASE/post-ts6.sha"
diff "$BASE/post-move.sha" "$BASE/post-ts6.sha" && echo IDENTICAL
```

Expected: `0 errors`, `388 passed`, `IDENTICAL`. `export =` 선언이 `as PagefindModule` 단언과 충돌해 오류가 나면 `const pagefind: { search(query: string): Promise<unknown> }; export = pagefind;` 처럼 `unknown` 을 구체 타입으로 바꾼다.

- [ ] **Step 8: 루트 스크립트 확장**

루트 `package.json` scripts 에 추가한다.

```json
"dev:workbench": "pnpm --filter @gze1206/workbench dev",
"typecheck": "pnpm -r --if-present typecheck",
"e2e": "pnpm -r --if-present e2e",
"verify": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build"
```

커버리지 리포트(하한 없음)를 붙인다. `pnpm-workspace.yaml` catalog 에 `'@vitest/coverage-v8': ^4.1.10` 을 더하고, 블로그·워크벤치 devDependencies 에 `"@vitest/coverage-v8": "catalog:"`, 각 `package.json` scripts 에 `"coverage": "vitest run --coverage"` 를 넣는다. 루트 scripts 에 `"coverage": "pnpm -r --if-present coverage"` 를 넣는다. 블로그에는 vitest 설정 파일이 없으므로 `apps/blog/vitest.config.ts` 를 만든다.

```ts
import { defineConfig } from 'vitest/config';

// 지금까지 블로그 테스트는 설정 파일 없이 기본값으로 돌았다. 그 동작은 그대로 두고 커버리지만 더한다.
export default defineConfig({
  test: { coverage: { provider: 'v8', reporter: ['text-summary', 'html'] } },
});
```

```bash
pnpm install
pnpm coverage 2>&1 | grep -E "Statements|Lines"
pnpm verify
```

Expected: 패키지별 커버리지 요약이 나오고(기준선으로 PR 에 적는다), `verify` 통과. 블로그 테스트 수는 그대로 388 이어야 한다. (Task 6·7 에서 `boundaries`·`spec:check` 를 `verify` 에 더한다.)

- [ ] **Step 9: 커밋 (둘로 나눈다)**

```bash
git add mise.toml pnpm-workspace.yaml package.json packages/config .prettierrc apps/*/package.json apps/*/eslint.config.* apps/workbench pnpm-lock.yaml
git commit -m "🔧 chore(infra): 툴체인을 Node 26·TS 6.0.3·공통 설정으로 맞춘다 (NOR-195)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git add apps/blog
git commit -m "🐛 fix(blog): TS 6 타입 검사 오류 8건을 고친다 (NOR-195)" \
  -m "astro check 를 처음 도입하면서 드러난 오류다. 페이지 산출물은 바뀌지 않는다." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 의존 경계 검사기

**Files:**

- Create: `packages/repo-tools/package.json`, `packages/repo-tools/tsconfig.json`, `packages/repo-tools/src/boundaries.ts`, `packages/repo-tools/src/boundaries.test.ts`, `packages/repo-tools/src/cli/boundaries.ts`
- Modify: 루트 `package.json`

**Interfaces:**

- Produces: `extractImportSpecifiers(source: string): string[]`, `findBoundaryViolations(sites: readonly ImportSite[], packages: readonly WorkspacePackage[]): BoundaryViolation[]`, 타입 `WorkspacePackage { name; dir }`, `ImportSite { file; specifier }`, `BoundaryViolation { file; specifier; reason }`. 경로는 모두 저장소 기준 POSIX 경로.

- [ ] **Step 1: 패키지 골격 (테스트 실행에 필요한 것만)**

`packages/repo-tools/package.json`:

```json
{
  "name": "@gze1206/repo-tools",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": { "test": "vitest run", "typecheck": "tsc -p tsconfig.json", "lint": "eslint ." },
  "devDependencies": {
    "@gze1206/config": "workspace:*",
    "@eslint/js": "catalog:",
    "@types/node": "catalog:",
    "eslint": "catalog:",
    "eslint-config-prettier": "catalog:",
    "typescript": "catalog:",
    "typescript-eslint": "catalog:",
    "vitest": "catalog:"
  }
}
```

`packages/repo-tools/tsconfig.json`:

```json
{
  "extends": "@gze1206/config/tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowImportingTsExtensions": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

`packages/repo-tools/eslint.config.js`:

```js
import { base, prettierLast } from '@gze1206/config/eslint';
export default [...base, prettierLast];
```

CLI 는 Node 26 의 타입 제거 실행(`node file.ts`)으로 돌리므로 상대 import 에 `.ts` 확장자를 쓴다.

- [ ] **Step 2: 실패하는 테스트**

`packages/repo-tools/src/boundaries.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractImportSpecifiers, findBoundaryViolations } from './boundaries.ts';

const packages = [
  { name: '@gze1206/blog', dir: 'apps/blog' },
  { name: '@gze1206/workbench', dir: 'apps/workbench' },
  { name: '@gze1206/content-contract', dir: 'packages/content-contract' },
];

describe('extractImportSpecifiers', () => {
  it('NOR-195 AC-1: 정적·동적·부수효과·재수출 import 를 모두 찾는다', () => {
    const source = [
      "import a from './a.ts';",
      'import { b } from "../b";',
      "import './side.css';",
      "export { c } from '@gze1206/content-contract';",
      "const d = await import('./lazy.js');",
      "import type { E } from 'zod';",
    ].join('\n');
    expect(extractImportSpecifiers(source)).toEqual([
      './a.ts',
      '../b',
      './side.css',
      '@gze1206/content-contract',
      './lazy.js',
      'zod',
    ]);
  });
});

describe('findBoundaryViolations', () => {
  it('NOR-195 AC-1: 패키지 안의 상대 import 와 packages 이름 import 는 허용한다', () => {
    expect(
      findBoundaryViolations(
        [
          { file: 'apps/blog/src/lib/a.ts', specifier: '../content/schemas' },
          { file: 'apps/blog/src/lib/a.ts', specifier: '@gze1206/content-contract' },
          { file: 'apps/workbench/src/server/x.ts', specifier: 'zod' },
        ],
        packages,
      ),
    ).toEqual([]);
  });

  it('NOR-195 AC-1: 패키지 디렉터리를 벗어나는 상대 import 를 보고한다', () => {
    expect(
      findBoundaryViolations(
        [{ file: 'apps/blog/src/lib/a.ts', specifier: '../../../workbench/src/core/x.ts' }],
        packages,
      ),
    ).toEqual([
      {
        file: 'apps/blog/src/lib/a.ts',
        specifier: '../../../workbench/src/core/x.ts',
        reason: 'relative import leaves apps/blog',
      },
    ]);
  });

  it('NOR-195 AC-1: apps 패키지를 이름으로 import 하면 보고한다', () => {
    expect(
      findBoundaryViolations(
        [{ file: 'packages/content-contract/src/x.ts', specifier: '@gze1206/blog/src/y' }],
        packages,
      ),
    ).toEqual([
      {
        file: 'packages/content-contract/src/x.ts',
        specifier: '@gze1206/blog/src/y',
        reason: 'apps must not be imported: @gze1206/blog',
      },
    ]);
  });
});
```

- [ ] **Step 3: 실패 확인**

```bash
pnpm install
pnpm --filter @gze1206/repo-tools test
```

Expected: FAIL — `Failed to load url ./boundaries.ts` 또는 `Cannot find module`.

- [ ] **Step 4: red 커밋**

```bash
git add packages/repo-tools pnpm-lock.yaml
git commit -m "✅ test(infra): 패키지 경계를 벗어나는 import 를 잡는 테스트를 쓴다 (NOR-195)" \
  -m "TDD: red" -m "Spec: NOR-195 AC-1" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: 최소 구현**

`packages/repo-tools/src/boundaries.ts`:

```ts
import path from 'node:path';

/** 워크스페이스 패키지. `dir` 은 저장소 기준 POSIX 경로다. */
export interface WorkspacePackage {
  readonly name: string;
  readonly dir: string;
}

export interface ImportSite {
  readonly file: string;
  readonly specifier: string;
}

export interface BoundaryViolation {
  readonly file: string;
  readonly specifier: string;
  readonly reason: string;
}

const IMPORT_PATTERN =
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/gu;

export function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2];
    if (specifier !== undefined) specifiers.push(specifier);
  }
  return specifiers;
}

function isInside(dir: string, target: string): boolean {
  return target === dir || target.startsWith(`${dir}/`);
}

export function findBoundaryViolations(
  sites: readonly ImportSite[],
  packages: readonly WorkspacePackage[],
): BoundaryViolation[] {
  const apps = packages.filter((pkg) => pkg.dir.startsWith('apps/'));
  const violations: BoundaryViolation[] = [];
  for (const site of sites) {
    const owner = packages.find((pkg) => isInside(pkg.dir, site.file));
    if (owner === undefined) continue;
    if (site.specifier.startsWith('.')) {
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(site.file), site.specifier),
      );
      if (!isInside(owner.dir, resolved)) {
        violations.push({ ...site, reason: `relative import leaves ${owner.dir}` });
      }
      continue;
    }
    const app = apps.find(
      (pkg) => site.specifier === pkg.name || site.specifier.startsWith(`${pkg.name}/`),
    );
    if (app !== undefined && app !== owner) {
      violations.push({ ...site, reason: `apps must not be imported: ${app.name}` });
    }
  }
  return violations;
}
```

- [ ] **Step 6: 통과 확인**

```bash
pnpm --filter @gze1206/repo-tools test
```

Expected: PASS (4 tests). 정적 import 정규식이 기대와 다르면 테스트가 아니라 정규식을 고친다.

- [ ] **Step 7: CLI**

`packages/repo-tools/src/cli/boundaries.ts`:

```ts
// 저장소 루트에서 실행한다: node packages/repo-tools/src/cli/boundaries.ts
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  extractImportSpecifiers,
  findBoundaryViolations,
  type ImportSite,
  type WorkspacePackage,
} from '../boundaries.ts';

const SOURCE_FILE = /\.(?:ts|tsx|mts|mjs|js|astro)$/u;
const SKIP_DIR = new Set(['node_modules', 'dist', '.astro', 'test-results', 'playwright-report']);

async function listPackages(root: string): Promise<WorkspacePackage[]> {
  const result: WorkspacePackage[] = [];
  for (const group of ['apps', 'packages']) {
    for (const entry of await readdir(path.join(root, group), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = `${group}/${entry.name}`;
      const manifest = JSON.parse(await readFile(path.join(root, dir, 'package.json'), 'utf8')) as {
        name: string;
      };
      result.push({ name: manifest.name, dir });
    }
  }
  return result;
}

async function* walk(root: string, dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if (SKIP_DIR.has(entry.name)) continue;
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) yield* walk(root, child);
    else if (SOURCE_FILE.test(entry.name)) yield child;
  }
}

const root = process.cwd();
const packages = await listPackages(root);
const sites: ImportSite[] = [];
for (const pkg of packages) {
  for await (const file of walk(root, pkg.dir)) {
    const source = await readFile(path.join(root, file), 'utf8');
    for (const specifier of extractImportSpecifiers(source)) sites.push({ file, specifier });
  }
}
const violations = findBoundaryViolations(sites, packages);
for (const v of violations) console.error(`✗ ${v.file}: '${v.specifier}' — ${v.reason}`);
console.log(`boundaries: ${sites.length} imports, ${violations.length} violations`);
process.exit(violations.length === 0 ? 0 : 1);
```

루트 `package.json` scripts 에 `"boundaries": "node packages/repo-tools/src/cli/boundaries.ts"` 를 넣고 `verify` 끝에 `&& pnpm boundaries` 를 붙인다.

```bash
pnpm boundaries
pnpm --filter @gze1206/repo-tools typecheck && pnpm --filter @gze1206/repo-tools lint
```

Expected: `0 violations`, typecheck·lint 통과.

- [ ] **Step 8: green 커밋**

```bash
git add packages/repo-tools package.json
git commit -m "✨ feat(infra): 패키지 경계 검사기를 만든다 (NOR-195)" \
  -m "TDD: green" -m "Spec: NOR-195 AC-1" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 명세–테스트 연결 검사 (`spec:check`)

**Files:**

- Create: `packages/repo-tools/src/spec-check.ts`, `packages/repo-tools/src/spec-check.test.ts`, `packages/repo-tools/src/cli/spec-check.ts`
- Modify: 루트 `package.json`

**Interfaces:**

- Produces: `parseSpecCriteria(specPath: string, markdown: string): AcceptanceCriterion[]`, `findCriterionReferences(source: string): Set<string>`, `findUnlinkedCriteria(criteria: readonly AcceptanceCriterion[], references: ReadonlySet<string>): AcceptanceCriterion[]`. `AcceptanceCriterion { ticket: string; id: string; manual: boolean; specPath: string }`, 참조 키는 `"NOR-12 AC-3"` 형식.

- [ ] **Step 1: 실패하는 테스트**

`packages/repo-tools/src/spec-check.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findCriterionReferences, findUnlinkedCriteria, parseSpecCriteria } from './spec-check.ts';

const spec = [
  '# NOR-12 — 예시',
  '',
  '- **AC-1** 첫 번째 기준',
  '- **AC-2** (manual) 눈으로 확인한다',
  '  - **AC-3** 들여쓴 기준',
  '본문에 AC-9 라고만 쓴 것은 기준이 아니다',
].join('\n');

describe('parseSpecCriteria', () => {
  it('NOR-195 AC-2: 파일명의 일감 번호와 목록의 AC 를 읽고 manual 을 구분한다', () => {
    expect(parseSpecCriteria('docs/spec/repo/NOR-12-example.md', spec)).toEqual([
      { ticket: 'NOR-12', id: 'AC-1', manual: false, specPath: 'docs/spec/repo/NOR-12-example.md' },
      { ticket: 'NOR-12', id: 'AC-2', manual: true, specPath: 'docs/spec/repo/NOR-12-example.md' },
      { ticket: 'NOR-12', id: 'AC-3', manual: false, specPath: 'docs/spec/repo/NOR-12-example.md' },
    ]);
  });

  it('NOR-195 AC-2: 일감 번호가 없는 파일은 비어 있다', () => {
    expect(parseSpecCriteria('docs/spec/README.md', spec)).toEqual([]);
  });
});

describe('findUnlinkedCriteria', () => {
  it('NOR-195 AC-2: 테스트 이름에 연결되지 않은 자동 기준만 보고한다', () => {
    const criteria = parseSpecCriteria('docs/spec/repo/NOR-12-example.md', spec);
    const references = findCriterionReferences(
      "it('NOR-12 AC-1: 첫 번째', () => {});\nit('NOR-13 AC-3: 다른 일감', () => {});",
    );
    expect(findUnlinkedCriteria(criteria, references).map((c) => c.id)).toEqual(['AC-3']);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
pnpm --filter @gze1206/repo-tools test src/spec-check.test.ts
```

Expected: FAIL — `Failed to load url ./spec-check.ts`.

- [ ] **Step 3: red 커밋**

```bash
git add packages/repo-tools/src/spec-check.test.ts
git commit -m "✅ test(infra): 테스트와 이어지지 않은 수용 기준을 찾는 테스트를 쓴다 (NOR-195)" \
  -m "TDD: red" -m "Spec: NOR-195 AC-2" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: 최소 구현**

`packages/repo-tools/src/spec-check.ts`:

```ts
export interface AcceptanceCriterion {
  readonly ticket: string;
  readonly id: string;
  readonly manual: boolean;
  readonly specPath: string;
}

const TICKET_IN_FILENAME = /(?:^|\/)(NOR-\d+)-[^/]*\.md$/u;
const CRITERION_LINE = /^\s*-\s+\*\*(AC-\d+)\*\*(\s*\(manual\))?/gmu;
const REFERENCE = /\b(NOR-\d+) (AC-\d+)\b/gu;

export function parseSpecCriteria(specPath: string, markdown: string): AcceptanceCriterion[] {
  const ticket = TICKET_IN_FILENAME.exec(specPath)?.[1];
  if (ticket === undefined) return [];
  return [...markdown.matchAll(CRITERION_LINE)].map((match) => ({
    ticket,
    id: match[1] ?? '',
    manual: match[2] !== undefined,
    specPath,
  }));
}

export function findCriterionReferences(source: string): Set<string> {
  return new Set([...source.matchAll(REFERENCE)].map((match) => `${match[1]} ${match[2]}`));
}

export function findUnlinkedCriteria(
  criteria: readonly AcceptanceCriterion[],
  references: ReadonlySet<string>,
): AcceptanceCriterion[] {
  return criteria.filter(
    (criterion) => !criterion.manual && !references.has(`${criterion.ticket} ${criterion.id}`),
  );
}
```

- [ ] **Step 5: 통과 확인**

```bash
pnpm --filter @gze1206/repo-tools test
```

Expected: PASS.

- [ ] **Step 6: CLI**

`packages/repo-tools/src/cli/spec-check.ts`:

```ts
// 저장소 루트에서 실행한다: node packages/repo-tools/src/cli/spec-check.ts
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  findCriterionReferences,
  findUnlinkedCriteria,
  parseSpecCriteria,
  type AcceptanceCriterion,
} from '../spec-check.ts';

const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|mts)$/u;
const SKIP = /(?:^|\/)(?:node_modules|dist|\.astro)(?:\/|$)/u;

async function files(root: string, dir: string, pattern: RegExp): Promise<string[]> {
  const entries = await readdir(path.join(root, dir), { recursive: true });
  return entries
    .map((entry) => `${dir}/${entry.split(path.sep).join('/')}`)
    .filter((file) => !SKIP.test(file) && pattern.test(file));
}

const root = process.cwd();
const criteria: AcceptanceCriterion[] = [];
for (const spec of await files(root, 'docs/spec', /\.md$/u)) {
  criteria.push(...parseSpecCriteria(spec, await readFile(path.join(root, spec), 'utf8')));
}
const references = new Set<string>();
for (const group of ['apps', 'packages']) {
  for (const test of await files(root, group, TEST_FILE)) {
    for (const ref of findCriterionReferences(await readFile(path.join(root, test), 'utf8'))) {
      references.add(ref);
    }
  }
}
const unlinked = findUnlinkedCriteria(criteria, references);
for (const c of unlinked)
  console.error(`✗ ${c.ticket} ${c.id} (${c.specPath}) 를 참조하는 테스트가 없다`);
console.log(`spec:check: ${criteria.length} criteria, ${unlinked.length} unlinked`);
process.exit(unlinked.length === 0 ? 0 : 1);
```

루트 `package.json` 에 `"spec:check": "node packages/repo-tools/src/cli/spec-check.ts"` 를 넣는다. 아직 `verify` 에는 넣지 않는다(AC-3~9 테스트가 생기기 전이라 실패한다). Task 12 끝에서 넣는다.

```bash
pnpm spec:check; echo "exit=$?"
```

Expected: `NOR-195 AC-3` ~ `AC-9` 가 unlinked 로 나오고 `exit=1`. 정상이다.

- [ ] **Step 7: green 커밋**

```bash
git add packages/repo-tools package.json
git commit -m "✨ feat(infra): 수용 기준과 테스트의 연결을 검사한다 (NOR-195)" \
  -m "TDD: green" -m "Spec: NOR-195 AC-2" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: red→green 증거 검사 (`tdd-evidence`)

**Files:**

- Create: `packages/repo-tools/src/tdd/trailers.ts`, `plan.ts`, `classify.ts`, `run.ts`, `tdd.test.ts`, `packages/repo-tools/src/cli/tdd-evidence.ts`
- Modify: 루트 `package.json`

**Interfaces:**

- Produces:
  - `LOG_FORMAT: string`, `parseCommitLog(raw: string): CommitInfo[]`, `CommitInfo { sha; subject; phase: TddPhase | undefined; specs: string[]; files: string[] }`, `TddPhase = 'red' | 'green' | 'refactor' | 'regression'`
  - `planRedGreenChecks(commits: readonly CommitInfo[]): RedGreenCheck[]`, `RedGreenCheck { red: string; green: string | undefined; testFiles: string[] }`, `packageDirOf(file: string): string | undefined`
  - `classifyRedRun(report: VitestJsonReport): RedVerdict`, `classifyGreenRun(report: VitestJsonReport): boolean`, `RedVerdict = {kind:'assertion'} | {kind:'missing-module'} | {kind:'passing'} | {kind:'broken'; reason: string}`
  - `runTddEvidence(options: { repoRoot: string; base: string; head: string }): Promise<{ ok: boolean; lines: string[] }>`

- [ ] **Step 1: 실패하는 테스트**

`packages/repo-tools/src/tdd/tdd.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyGreenRun, classifyRedRun, type VitestJsonReport } from './classify.ts';
import { packageDirOf, planRedGreenChecks } from './plan.ts';
import { parseCommitLog } from './trailers.ts';

const RS = '\x1e';
const US = '\x1f';

describe('parseCommitLog', () => {
  it('NOR-195 AC-3: 커밋마다 TDD·Spec trailer 와 바뀐 파일을 읽는다', () => {
    const raw =
      `${RS}aaa${US}✅ test: red${US}red\n${US}NOR-1 AC-2\n\n\napps/blog/src/a.test.ts\n` +
      `${RS}bbb${US}✨ feat: green${US}green${US}\n\napps/blog/src/a.ts\n` +
      `${RS}ccc${US}📝 docs${US}${US}\n\ndocs/x.md\n`;
    expect(parseCommitLog(raw)).toEqual([
      {
        sha: 'aaa',
        subject: '✅ test: red',
        phase: 'red',
        specs: ['NOR-1 AC-2'],
        files: ['apps/blog/src/a.test.ts'],
      },
      {
        sha: 'bbb',
        subject: '✨ feat: green',
        phase: 'green',
        specs: [],
        files: ['apps/blog/src/a.ts'],
      },
      { sha: 'ccc', subject: '📝 docs', phase: undefined, specs: [], files: ['docs/x.md'] },
    ]);
  });

  it('NOR-195 AC-3: 모르는 TDD 단계는 거부한다', () => {
    expect(() => parseCommitLog(`${RS}aaa${US}x${US}blue${US}\n`)).toThrow(
      /unknown TDD phase "blue"/u,
    );
  });
});

describe('planRedGreenChecks', () => {
  const commit = (sha: string, phase: 'red' | 'green' | undefined, files: string[]) => ({
    sha,
    subject: sha,
    phase,
    specs: [],
    files,
  });

  it('NOR-195 AC-3: red 마다 다음 green 과 바뀐 테스트 파일을 짝짓는다', () => {
    expect(
      planRedGreenChecks([
        commit('r1', 'red', ['apps/blog/src/a.test.ts', 'apps/blog/src/a.ts']),
        commit('d1', undefined, ['docs/x.md']),
        commit('g1', 'green', ['apps/blog/src/a.ts']),
        commit('r2', 'red', ['packages/x/src/b.test.ts']),
      ]),
    ).toEqual([
      { red: 'r1', green: 'g1', testFiles: ['apps/blog/src/a.test.ts'] },
      { red: 'r2', green: undefined, testFiles: ['packages/x/src/b.test.ts'] },
    ]);
  });

  it('NOR-195 AC-3: 테스트 파일을 바꾸지 않은 red 는 거부한다', () => {
    expect(() => planRedGreenChecks([commit('r1', 'red', ['apps/blog/src/a.ts'])])).toThrow(
      /r1 changes no test file/u,
    );
  });

  it('NOR-195 AC-3: 테스트 파일이 속한 패키지 디렉터리를 찾는다', () => {
    expect(packageDirOf('apps/blog/src/a.test.ts')).toBe('apps/blog');
    expect(packageDirOf('packages/repo-tools/src/x.test.ts')).toBe('packages/repo-tools');
    expect(packageDirOf('scripts/x.test.ts')).toBeUndefined();
  });
});

function report(overrides: Partial<VitestJsonReport>): VitestJsonReport {
  return {
    numFailedTests: 0,
    numPassedTests: 0,
    numFailedTestSuites: 0,
    testResults: [],
    ...overrides,
  };
}

describe('classifyRedRun', () => {
  it('NOR-195 AC-3: 단언 실패는 red 로 인정한다', () => {
    expect(
      classifyRedRun(
        report({
          numFailedTests: 1,
          testResults: [
            { name: 'a', status: 'failed', message: '', assertionResults: [{ status: 'failed' }] },
          ],
        }),
      ),
    ).toEqual({ kind: 'assertion' });
  });

  it('NOR-195 AC-3: 아직 없는 모듈 때문에 못 읽은 테스트는 red 로 인정한다', () => {
    expect(
      classifyRedRun(
        report({
          numFailedTestSuites: 1,
          testResults: [
            {
              name: 'a',
              status: 'failed',
              message: 'Error: Failed to load url ./x.ts (resolved id: ./x.ts)',
              assertionResults: [],
            },
          ],
        }),
      ),
    ).toEqual({ kind: 'missing-module' });
  });

  it('NOR-195 AC-3: 문법 오류는 가짜 red 로 거부한다', () => {
    expect(
      classifyRedRun(
        report({
          numFailedTestSuites: 1,
          testResults: [
            {
              name: 'a',
              status: 'failed',
              message: 'SyntaxError: Unexpected token',
              assertionResults: [],
            },
          ],
        }),
      ),
    ).toEqual({ kind: 'broken', reason: 'SyntaxError: Unexpected token' });
  });

  it('NOR-195 AC-3: 통과하는 테스트는 red 가 아니다', () => {
    expect(
      classifyRedRun(
        report({
          numPassedTests: 1,
          testResults: [
            { name: 'a', status: 'passed', message: '', assertionResults: [{ status: 'passed' }] },
          ],
        }),
      ),
    ).toEqual({ kind: 'passing' });
  });
});

describe('classifyGreenRun', () => {
  it('NOR-195 AC-3: 실패 없이 하나 이상 통과해야 green 이다', () => {
    expect(classifyGreenRun(report({ numPassedTests: 2 }))).toBe(true);
    expect(classifyGreenRun(report({ numPassedTests: 0 }))).toBe(false);
    expect(classifyGreenRun(report({ numPassedTests: 2, numFailedTests: 1 }))).toBe(false);
    expect(classifyGreenRun(report({ numPassedTests: 2, numFailedTestSuites: 1 }))).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
pnpm --filter @gze1206/repo-tools test src/tdd
```

Expected: FAIL — `Failed to load url ./classify.ts`.

- [ ] **Step 3: red 커밋**

```bash
git add packages/repo-tools/src/tdd/tdd.test.ts
git commit -m "✅ test(infra): red→green 증거를 판정하는 테스트를 쓴다 (NOR-195)" \
  -m "TDD: red" -m "Spec: NOR-195 AC-3" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: 구현 — `trailers.ts`**

```ts
export type TddPhase = 'red' | 'green' | 'refactor' | 'regression';

export interface CommitInfo {
  readonly sha: string;
  readonly subject: string;
  readonly phase: TddPhase | undefined;
  readonly specs: string[];
  readonly files: string[];
}

/** `git log --name-only` 와 함께 쓴다. 커밋마다 RS 로 시작하고 필드는 US 로 나뉜다. */
export const LOG_FORMAT =
  '%x1e%H%x1f%s%x1f%(trailers:key=TDD,valueonly,separator=%x2c)%x1f%(trailers:key=Spec,valueonly,separator=%x2c)';

const PHASES: ReadonlySet<string> = new Set(['red', 'green', 'refactor', 'regression']);

export function parseCommitLog(raw: string): CommitInfo[] {
  return raw
    .split('\x1e')
    .filter((chunk) => chunk.trim() !== '')
    .map((chunk) => {
      const [sha = '', subject = '', tdd = '', rest = ''] = chunk.split('\x1f');
      const [specLine = '', ...fileLines] = rest.split('\n');
      const phase = tdd.trim();
      if (phase !== '' && !PHASES.has(phase)) {
        throw new Error(`unknown TDD phase "${phase}" in ${sha}`);
      }
      return {
        sha,
        subject,
        phase: phase === '' ? undefined : (phase as TddPhase),
        specs: specLine
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s !== ''),
        files: fileLines.map((f) => f.trim()).filter((f) => f !== ''),
      };
    });
}
```

trailer 값 뒤에 개행이 붙는 경우가 있으므로(`red\n`) 테스트 입력의 첫 커밋이 그 모양이다. `tdd` 필드는 `trim()` 하고, `Spec` 필드와 파일 목록은 같은 마지막 필드(`rest`)의 첫 줄과 나머지 줄이다.

- [ ] **Step 5: 구현 — `plan.ts`**

```ts
import type { CommitInfo } from './trailers.ts';

export interface RedGreenCheck {
  readonly red: string;
  readonly green: string | undefined;
  readonly testFiles: string[];
}

export const TEST_FILE = /\.test\.(?:ts|tsx|mts)$/u;
const PACKAGE_DIR = /^((?:apps|packages)\/[^/]+)\//u;

export function packageDirOf(file: string): string | undefined {
  return PACKAGE_DIR.exec(file)?.[1];
}

export function planRedGreenChecks(commits: readonly CommitInfo[]): RedGreenCheck[] {
  const checks: RedGreenCheck[] = [];
  commits.forEach((commit, index) => {
    if (commit.phase !== 'red') return;
    const testFiles = commit.files.filter((file) => TEST_FILE.test(file));
    if (testFiles.length === 0) throw new Error(`red commit ${commit.sha} changes no test file`);
    const green = commits.slice(index + 1).find((later) => later.phase === 'green');
    checks.push({ red: commit.sha, green: green?.sha, testFiles });
  });
  return checks;
}
```

- [ ] **Step 6: 구현 — `classify.ts`**

```ts
export interface VitestJsonReport {
  readonly numFailedTests: number;
  readonly numPassedTests: number;
  readonly numFailedTestSuites: number;
  readonly testResults: readonly {
    readonly name: string;
    readonly status: string;
    readonly message?: string;
    readonly assertionResults: readonly { readonly status: string }[];
  }[];
}

export type RedVerdict =
  | { readonly kind: 'assertion' }
  | { readonly kind: 'missing-module' }
  | { readonly kind: 'passing' }
  | { readonly kind: 'broken'; readonly reason: string };

const MISSING_MODULE =
  /Cannot find module|Cannot find package|Failed to (?:load|resolve) (?:url|import)|does not provide an export named/u;
const BROKEN = /SyntaxError|Transform failed|Unexpected token|Parse failure/u;

export function classifyRedRun(report: VitestJsonReport): RedVerdict {
  if (
    report.testResults.some((suite) => suite.assertionResults.some((a) => a.status === 'failed'))
  ) {
    return { kind: 'assertion' };
  }
  const messages = report.testResults
    .filter((suite) => suite.status === 'failed')
    .map((suite) => suite.message ?? '');
  if (messages.length === 0) return { kind: 'passing' };
  const broken = messages.find((message) => BROKEN.test(message) || !MISSING_MODULE.test(message));
  if (broken !== undefined) return { kind: 'broken', reason: broken.split('\n')[0] ?? broken };
  return { kind: 'missing-module' };
}

export function classifyGreenRun(report: VitestJsonReport): boolean {
  return (
    report.numFailedTests === 0 && report.numFailedTestSuites === 0 && report.numPassedTests > 0
  );
}
```

- [ ] **Step 7: 통과 확인**

```bash
pnpm --filter @gze1206/repo-tools test
```

Expected: PASS.

- [ ] **Step 8: 구현 — `run.ts` 와 CLI**

`packages/repo-tools/src/tdd/run.ts`:

```ts
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { classifyGreenRun, classifyRedRun, type VitestJsonReport } from './classify.ts';
import { packageDirOf, planRedGreenChecks } from './plan.ts';
import { LOG_FORMAT, parseCommitLog } from './trailers.ts';

const exec = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;

/** 커밋 하나를 임시 worktree 에 풀고, 바뀐 테스트 파일만 패키지별로 돌린다. */
async function runTestsAt(
  repoRoot: string,
  scratch: string,
  sha: string,
  testFiles: readonly string[],
): Promise<(VitestJsonReport | undefined)[]> {
  const dir = path.join(scratch, sha);
  await exec('git', ['worktree', 'add', '--detach', dir, sha], { cwd: repoRoot });
  try {
    await exec('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], {
      cwd: dir,
      maxBuffer: MAX_BUFFER,
    });
    const byPackage = new Map<string, string[]>();
    for (const file of testFiles) {
      const pkg = packageDirOf(file);
      if (pkg === undefined) throw new Error(`test outside any package: ${file}`);
      byPackage.set(pkg, [...(byPackage.get(pkg) ?? []), path.posix.relative(pkg, file)]);
    }
    const reports: (VitestJsonReport | undefined)[] = [];
    for (const [pkg, files] of byPackage) {
      const out = path.join(scratch, `${sha}-${pkg.replaceAll('/', '_')}.json`);
      // 실패하면 종료 코드가 0 이 아니다. 판정은 리포트로 한다.
      await exec(
        'pnpm',
        ['exec', 'vitest', 'run', ...files, '--reporter=json', `--outputFile=${out}`],
        {
          cwd: path.join(dir, pkg),
          maxBuffer: MAX_BUFFER,
        },
      ).catch(() => undefined);
      reports.push(
        await readFile(out, 'utf8')
          .then((text) => JSON.parse(text) as VitestJsonReport)
          .catch(() => undefined),
      );
    }
    return reports;
  } finally {
    await exec('git', ['worktree', 'remove', '--force', dir], { cwd: repoRoot });
  }
}

export async function runTddEvidence(options: {
  readonly repoRoot: string;
  readonly base: string;
  readonly head: string;
}): Promise<{ ok: boolean; lines: string[] }> {
  const { stdout } = await exec(
    'git',
    [
      'log',
      '--reverse',
      `--format=${LOG_FORMAT}`,
      '--name-only',
      `${options.base}..${options.head}`,
    ],
    { cwd: options.repoRoot, maxBuffer: MAX_BUFFER },
  );
  const checks = planRedGreenChecks(parseCommitLog(stdout));
  const lines: string[] = [];
  let ok = true;
  const scratch = await mkdtemp(path.join(tmpdir(), 'tdd-evidence-'));
  try {
    for (const check of checks) {
      const red = check.red.slice(0, 7);
      if (check.green === undefined) {
        ok = false;
        lines.push(`✗ ${red}: 뒤따르는 TDD: green 커밋이 없다`);
        continue;
      }
      const redReports = await runTestsAt(options.repoRoot, scratch, check.red, check.testFiles);
      const verdicts = redReports.map((r) =>
        r === undefined
          ? ({ kind: 'broken', reason: 'Vitest JSON 리포트가 없다' } as const)
          : classifyRedRun(r),
      );
      const bad = verdicts.find((v) => v.kind === 'passing' || v.kind === 'broken');
      if (bad !== undefined) {
        ok = false;
        lines.push(
          `✗ ${red}: red 가 아니다 (${bad.kind === 'broken' ? bad.reason : '테스트가 통과한다'})`,
        );
        continue;
      }
      const greenReports = await runTestsAt(
        options.repoRoot,
        scratch,
        check.green,
        check.testFiles,
      );
      const greenOk = greenReports.every((r) => r !== undefined && classifyGreenRun(r));
      if (!greenOk) ok = false;
      lines.push(
        `${greenOk ? '✓' : '✗'} ${red} → ${check.green.slice(0, 7)}: ${verdicts.map((v) => v.kind).join(', ')} → ${greenOk ? 'green' : 'green 이 아니다'}`,
      );
    }
    lines.push(`tdd-evidence: ${checks.length} red commits checked`);
    return { ok, lines };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
```

`packages/repo-tools/src/cli/tdd-evidence.ts`:

```ts
// 저장소 루트에서 실행한다: node packages/repo-tools/src/cli/tdd-evidence.ts --base origin/v4
import { parseArgs } from 'node:util';
import { runTddEvidence } from '../tdd/run.ts';

const { values } = parseArgs({
  options: { base: { type: 'string' }, head: { type: 'string', default: 'HEAD' } },
});
if (values.base === undefined) {
  console.error('--base 가 필요하다');
  process.exit(2);
}
const result = await runTddEvidence({
  repoRoot: process.cwd(),
  base: values.base,
  head: values.head,
});
for (const line of result.lines) console.log(line);
process.exit(result.ok ? 0 : 1);
```

루트 `package.json` 에 `"tdd:evidence": "node packages/repo-tools/src/cli/tdd-evidence.ts"` 를 넣는다.

- [ ] **Step 9: 실제 이력으로 확인**

```bash
pnpm --filter @gze1206/repo-tools typecheck && pnpm --filter @gze1206/repo-tools lint
git stash -u   # 작업 트리를 깨끗하게 (worktree 는 커밋만 본다)
pnpm tdd:evidence --base v4
git stash pop
```

Expected: Task 6·7 의 red 커밋 두 개가 `✓ … missing-module → green` 으로 나오고 exit 0. (Task 8 자신의 red 는 아직 green 커밋 전이라 `뒤따르는 green 이 없다` 로 나온다. 정상이다.)

- [ ] **Step 10: green 커밋**

```bash
git add packages/repo-tools package.json
git commit -m "✨ feat(infra): red→green 증거를 커밋 이력에서 검증한다 (NOR-195)" \
  -m "TDD: green" -m "Spec: NOR-195 AC-3" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
pnpm tdd:evidence --base v4
```

Expected: 세 red 커밋 모두 `✓`, exit 0.

---

### Task 9: `@gze1206/content-contract`

**Files:**

- Create: `packages/content-contract/{package.json,tsconfig.json,eslint.config.js}`, `src/slug.ts`, `src/post.ts`, `src/series.ts`, `src/layout.ts`, `src/index.ts`, `src/post.test.ts`, `src/layout.test.ts`

**Interfaces:**

- Produces: `SLUG_PATTERN`, `SLUG_PATTERN_MESSAGE`, `TOC_MODES`, `tocSchema`, `postObject`, `postSchema`, `strictPostSchema`, `type Post = z.infer<typeof postSchema>`, `POST_FIELD_ORDER`, `seriesSchema`, `type Series`, `BLOG_LAYOUT = { postsDir: 'apps/blog/src/content/posts'; publicDir: 'apps/blog/public'; publishBranch: 'v4' }`. 상대 import 는 `.js` 확장자(Astro·Vite·NodeNext 모두 해석한다).

- [ ] **Step 1: 패키지 골격**

`packages/content-contract/package.json`:

```json
{
  "name": "@gze1206/content-contract",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc -p tsconfig.json", "lint": "eslint ." },
  "peerDependencies": { "zod": "catalog:" },
  "devDependencies": {
    "@gze1206/config": "workspace:*",
    "@eslint/js": "catalog:",
    "@types/node": "catalog:",
    "eslint": "catalog:",
    "eslint-config-prettier": "catalog:",
    "typescript": "catalog:",
    "typescript-eslint": "catalog:",
    "vitest": "catalog:",
    "yaml": "catalog:",
    "zod": "catalog:"
  }
}
```

`packages/content-contract/tsconfig.json`:

```json
{
  "extends": "@gze1206/config/tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src"]
}
```

`packages/content-contract/eslint.config.js`: Task 6 Step 1 의 것과 같은 두 줄.

- [ ] **Step 2: 실패하는 테스트**

`packages/content-contract/src/post.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { POST_FIELD_ORDER, postObject, postSchema, strictPostSchema } from './index.js';

const valid = {
  title: '글',
  description: '설명',
  slug: 'hello-world',
  category: 'dev',
  tags: ['astro'],
  publishedAt: '2026-11-12',
  updatedAt: '2026-11-12',
};

describe('postSchema', () => {
  it('NOR-195 AC-4: toc 는 auto·inline·floating·false 만 받고 기본값은 auto 다', () => {
    expect(postSchema.parse(valid).toc).toBe('auto');
    for (const toc of ['auto', 'inline', 'floating', false] as const) {
      expect(postSchema.parse({ ...valid, toc }).toc).toBe(toc);
    }
    expect(postSchema.safeParse({ ...valid, toc: 'sidebar' }).success).toBe(false);
    expect(postSchema.safeParse({ ...valid, toc: true }).success).toBe(false);
  });

  it('NOR-195 AC-4: series 와 seriesOrder 는 함께 있어야 한다 (두 변형 모두)', () => {
    for (const schema of [postSchema, strictPostSchema]) {
      expect(schema.safeParse({ ...valid, series: 's' }).success).toBe(false);
      expect(schema.safeParse({ ...valid, seriesOrder: 1 }).success).toBe(false);
      expect(schema.safeParse({ ...valid, series: 's', seriesOrder: 1 }).success).toBe(true);
    }
  });

  it('NOR-195 AC-4: 빈 제목과 대문자 slug 를 거부한다', () => {
    expect(postSchema.safeParse({ ...valid, title: '  ' }).success).toBe(false);
    expect(postSchema.safeParse({ ...valid, slug: 'Hello' }).success).toBe(false);
    expect(postSchema.safeParse({ ...valid, tags: [] }).success).toBe(false);
  });

  it('NOR-195 AC-4: strict 변형만 모르는 키를 거부한다', () => {
    expect(postSchema.safeParse({ ...valid, extra: 1 }).success).toBe(true);
    expect(strictPostSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });

  it('NOR-195 AC-4: 날짜는 Date 로 강제 변환하고 draft 기본값은 false 다', () => {
    const post = postSchema.parse(valid);
    expect(post.publishedAt).toBeInstanceOf(Date);
    expect(post.draft).toBe(false);
  });

  it('NOR-195 AC-4: POST_FIELD_ORDER 는 스키마의 모든 키를 정확히 한 번씩 담는다', () => {
    expect(new Set(POST_FIELD_ORDER).size).toBe(POST_FIELD_ORDER.length);
    expect([...POST_FIELD_ORDER].sort()).toEqual(Object.keys(postObject.shape).sort());
  });
});
```

`packages/content-contract/src/layout.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BLOG_LAYOUT } from './index.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('BLOG_LAYOUT', () => {
  it('NOR-195 AC-7: 경로가 실제 블로그 디렉터리를 가리킨다', () => {
    expect(existsSync(`${repoRoot}${BLOG_LAYOUT.postsDir}`)).toBe(true);
    expect(existsSync(`${repoRoot}${BLOG_LAYOUT.publicDir}`)).toBe(true);
  });
});
```

- [ ] **Step 3: 실패 확인 후 red 커밋**

```bash
pnpm install
pnpm --filter @gze1206/content-contract test
```

Expected: FAIL — `Failed to load url ./index.js`.

```bash
git add packages/content-contract pnpm-lock.yaml
git commit -m "✅ test(contract): 글 계약과 블로그 레이아웃의 테스트를 쓴다 (NOR-195)" \
  -m "TDD: red" -m "Spec: NOR-195 AC-4, NOR-195 AC-7" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: 구현**

`src/slug.ts`:

```ts
/** URL 슬러그 — 소문자·숫자·하이픈만, 하이픈 연속·양끝 금지. 블로그와 워크벤치가 같은 규칙을 쓴다. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** 슬러그 규칙을 사람이 읽는 문장으로. */
export const SLUG_PATTERN_MESSAGE =
  '소문자·숫자·하이픈만 쓸 수 있습니다 (예: hello-world). 하이픈으로 시작/끝나거나 연달아 쓸 수 없습니다.';
```

`src/post.ts`:

```ts
import { z } from 'zod';
import { SLUG_PATTERN } from './slug.js';

const text = z.string().trim().min(1);

/**
 * 목차를 어디에 둘지 (NOR-150).
 * `auto` 상단 + 화면 밖이면 플로팅, `inline` 상단만, `floating` 플로팅만, `false` 없음.
 */
export const TOC_MODES = ['auto', 'inline', 'floating'] as const;
export const tocSchema = z.union([z.enum(TOC_MODES), z.literal(false)]);

/** refine 전의 모양. 키 목록 검사와 strict 변형이 여기서 갈라진다. */
export const postObject = z.object({
  title: text,
  description: text,
  slug: z.string().regex(SLUG_PATTERN),
  category: text,
  tags: z.array(text).min(1),
  series: text.optional(),
  seriesOrder: z.number().int().positive().optional(),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  draft: z.boolean().default(false),
  toc: tocSchema.default('auto'),
});

const seriesPaired = (post: { series?: string | undefined; seriesOrder?: number | undefined }) =>
  (post.series === undefined) === (post.seriesOrder === undefined);
const SERIES_PAIR = {
  message: 'series와 seriesOrder는 둘 다 있거나 둘 다 없어야 합니다',
  path: ['seriesOrder'],
};

/** 블로그가 쓴다. 모르는 키는 버리고 빌드를 깨지 않는다. */
export const postSchema = postObject.refine(seriesPaired, SERIES_PAIR);
/** 워크벤치 발행기가 쓴다. 오타 필드가 공개 저장소로 나가지 않게 모르는 키를 거부한다. */
export const strictPostSchema = postObject.strict().refine(seriesPaired, SERIES_PAIR);

export type Post = z.infer<typeof postSchema>;

/** 직렬화 키 순서. 순서가 고정되어야 Git diff 가 최소가 된다. */
export const POST_FIELD_ORDER = [
  'title',
  'description',
  'slug',
  'category',
  'tags',
  'series',
  'seriesOrder',
  'publishedAt',
  'updatedAt',
  'draft',
  'toc',
] as const satisfies readonly (keyof typeof postObject.shape)[];
```

`src/series.ts`:

```ts
import { z } from 'zod';
import { SLUG_PATTERN } from './slug.js';

export const seriesSchema = z.object({
  name: z.string(),
  slug: z.string().regex(SLUG_PATTERN),
  description: z.string(),
});

export type Series = z.infer<typeof seriesSchema>;
```

`src/layout.ts`:

```ts
/**
 * 워크벤치가 블로그에 쓰는 자리. 저장소 루트 기준 경로다.
 * `publishBranch` 는 하위 프로젝트 4 에서 배포 방식을 정할 때까지 통합 브랜치다.
 */
export const BLOG_LAYOUT = {
  postsDir: 'apps/blog/src/content/posts',
  publicDir: 'apps/blog/public',
  publishBranch: 'v4',
} as const;
```

`src/index.ts`:

```ts
export { SLUG_PATTERN, SLUG_PATTERN_MESSAGE } from './slug.js';
export {
  POST_FIELD_ORDER,
  TOC_MODES,
  postObject,
  postSchema,
  strictPostSchema,
  tocSchema,
  type Post,
} from './post.js';
export { seriesSchema, type Series } from './series.js';
export { BLOG_LAYOUT } from './layout.js';
```

- [ ] **Step 5: 통과 확인**

```bash
pnpm --filter @gze1206/content-contract test
pnpm --filter @gze1206/content-contract typecheck && pnpm --filter @gze1206/content-contract lint
```

Expected: PASS (7 tests), typecheck·lint 통과. `satisfies` 에서 타입 오류가 나면 `POST_FIELD_ORDER` 에 오타가 있는 것이다.

- [ ] **Step 6: green 커밋**

```bash
git add packages/content-contract
git commit -m "✨ feat(contract): 글·시리즈 계약과 블로그 레이아웃을 한 곳에 둔다 (NOR-195)" \
  -m "TDD: green" -m "Spec: NOR-195 AC-4, NOR-195 AC-7" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: 실제 글 전수 검사 (regression)**

`packages/content-contract/src/corpus.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { BLOG_LAYOUT, strictPostSchema } from './index.js';

const postsDir = fileURLToPath(new URL(`../../../${BLOG_LAYOUT.postsDir}/`, import.meta.url));
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/u;

describe('블로그 글 전수', () => {
  it('NOR-195 AC-9: 모든 글 frontmatter 가 strict 계약을 통과한다', () => {
    const files = readdirSync(postsDir).filter((name) => /\.(?:md|mdx|mdoc)$/u.test(name));
    expect(files.length).toBeGreaterThan(0);
    const failures = files.flatMap((name) => {
      const match = FRONTMATTER.exec(readFileSync(`${postsDir}${name}`, 'utf8'));
      const result = strictPostSchema.safeParse(parse(match?.[1] ?? ''));
      return result.success ? [] : [`${name}: ${result.error.message}`];
    });
    expect(failures).toEqual([]);
  });
});
```

```bash
pnpm --filter @gze1206/content-contract test src/corpus.test.ts
```

Expected: PASS. 실패하면 그 글이 계약 밖의 키를 쓰거나 빈 값이 있다는 뜻이다 — 글을 고치지 말고 사용자에게 보고한다(계약을 넓힐지 글을 고칠지는 사용자 결정).

```bash
git add packages/content-contract/src/corpus.test.ts
git commit -m "✅ test(contract): 블로그의 모든 글이 strict 계약을 지키는지 본다 (NOR-195)" \
  -m "TDD: regression" -m "Spec: NOR-195 AC-9" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 블로그가 계약을 쓴다

**Files:**

- Create: `apps/blog/src/content/contract-wiring.test.ts`
- Modify: `apps/blog/package.json`, `apps/blog/src/content/schemas.ts:1-56`, `apps/blog/src/content/slug-pattern.ts`

- [ ] **Step 1: 의존성 추가와 실패하는 테스트**

`apps/blog/package.json` dependencies 에 `"@gze1206/content-contract": "workspace:*"`, `"zod": "catalog:"` 를 넣는다.

`apps/blog/src/content/contract-wiring.test.ts`:

```ts
import {
  postSchema as contractPost,
  seriesSchema as contractSeries,
} from '@gze1206/content-contract';
import { describe, expect, it } from 'vitest';
import { postSchema, seriesSchema } from './schemas';

describe('계약 연결', () => {
  it('NOR-195 AC-5: 블로그의 글·시리즈 스키마는 계약 패키지의 것과 같은 객체다', () => {
    expect(postSchema).toBe(contractPost);
    expect(seriesSchema).toBe(contractSeries);
  });
});
```

```bash
pnpm install
pnpm why zod -r | grep -E '^zod|zod@' | sort -u
pnpm --filter @gze1206/blog test src/content/contract-wiring.test.ts
```

Expected: zod 는 한 버전만 보인다(두 버전이면 catalog 범위를 astro 의 것과 맞춘다). 테스트는 FAIL — `expected [ZodObject] to be [ZodObject]` 류의 단언 실패.

- [ ] **Step 2: red 커밋**

```bash
git add apps/blog/package.json apps/blog/src/content/contract-wiring.test.ts pnpm-lock.yaml
git commit -m "✅ test(blog): 블로그가 계약 패키지의 스키마를 쓰는지 본다 (NOR-195)" \
  -m "TDD: red" -m "Spec: NOR-195 AC-5" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: 구현**

`apps/blog/src/content/schemas.ts` 에서 `postSchema`(17~~48행)와 `seriesSchema`(50~~54행) 정의를 지우고, 파일 맨 위를 다음으로 바꾼다. 나머지 스키마(portfolio·profile·experience·book)는 그대로 `astro/zod` 를 쓴다.

```ts
import { z } from 'astro/zod';
import { SLUG_PATTERN } from './slug-pattern';

// 글·시리즈는 워크벤치와 함께 지키는 계약이라 한 곳에서 정의한다 (NOR-195).
export { postSchema, seriesSchema } from '@gze1206/content-contract';
```

`SLUG_PATTERN` 을 더는 쓰지 않으면 import 를 지운다(나머지 스키마가 쓰면 남긴다).

`apps/blog/src/content/slug-pattern.ts`:

```ts
// 슬러그 규칙은 계약 패키지가 정의한다. 기존 import 경로를 지키려고 다시 내보낸다.
export { SLUG_PATTERN, SLUG_PATTERN_MESSAGE } from '@gze1206/content-contract';
```

- [ ] **Step 4: 통과·빌드·바이트 비교**

```bash
pnpm --filter @gze1206/blog test 2>&1 | grep -E "Tests "
pnpm --filter @gze1206/blog typecheck 2>&1 | tail -3
pnpm --filter @gze1206/blog build && hashdist apps/blog/dist > "$BASE/post-contract.sha"
diff "$BASE/post-ts6.sha" "$BASE/post-contract.sha" && echo IDENTICAL
```

Expected: `389 passed`(기존 388 + 1), `0 errors`, `IDENTICAL`. 다르면 계약의 `trim().min(1)` 이 어떤 글의 값을 바꿨는지 확인하고 사용자에게 보고한다.

- [ ] **Step 5: green 커밋**

```bash
git add apps/blog
git commit -m "♻️ refactor(blog): 글·시리즈 스키마를 계약 패키지에서 가져온다 (NOR-195)" \
  -m "dist 는 계약 적용 전과 바이트 단위로 같다." \
  -m "TDD: green" -m "Spec: NOR-195 AC-5, NOR-195 AC-10" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: 워크벤치가 `toc` 를 지킨다

**Files:**

- Modify: `apps/workbench/package.json`, `apps/workbench/src/core/publishing/contract.ts`(전체 교체), `apps/workbench/src/core/publishing/validate.ts:37-48`, `apps/workbench/src/core/publishing/transform.ts:10-21,42`, `apps/workbench/src/core/document/document.ts`(commonSchema·knownKeys·kindKeys)
- Test: `apps/workbench/src/core/publishing/publishing.test.ts`

**Interfaces:**

- Consumes: `strictPostSchema`, `postSchema`, `tocSchema`, `POST_FIELD_ORDER`, `type Post` (Task 9)
- Produces: `PublicPost = Omit<Post, 'publishedAt' | 'updatedAt' | 'toc'> & { readonly publishedAt: string; readonly updatedAt: string; readonly toc?: Post['toc'] }`, `parsePublishedPost(input: unknown): PublicPost` (이름 유지)

- [ ] **Step 1: 의존성과 실패하는 테스트**

`apps/workbench/package.json` 의 **devDependencies** 에 `"@gze1206/content-contract": "workspace:*"` 를 넣는다(서버 번들에 인라인되므로 런타임 의존이 아니다 — Task 13). `zod` 는 `"catalog:"`.

`apps/workbench/src/core/publishing/publishing.test.ts` 의 `describe('validatePublicDraft'` 앞에 추가한다.

```ts
const tocDraft = validDraft.replace(
  'publishedAt: 2026-08-12\n',
  'publishedAt: 2026-08-12\ntoc: floating\n',
);

describe('toc', () => {
  it('NOR-195 AC-6: 초안의 toc 를 발행 결과에 남긴다', () => {
    const result = transformPublicDraft({
      source: tocDraft,
      privateRoot: '/srv/private-workbench',
      assets: [],
    });
    expect(result.metadata.toc).toBe('floating');
    expect(result.source).toMatch(/^toc: floating$/mu);
  });
});
```

```bash
pnpm install
pnpm --filter @gze1206/workbench test src/core/publishing
```

Expected: FAIL — `expected undefined to be 'floating'`.

- [ ] **Step 2: red 커밋**

```bash
git add apps/workbench/package.json apps/workbench/src/core/publishing/publishing.test.ts pnpm-lock.yaml
git commit -m "✅ test(workbench): 발행하면 초안의 toc 가 사라지는 버그를 재현한다 (NOR-195)" \
  -m "TDD: red" -m "Spec: NOR-195 AC-6" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: 구현**

`apps/workbench/src/core/publishing/contract.ts` 전체:

```ts
import { strictPostSchema, type Post } from '@gze1206/content-contract';

/**
 * 워크벤치가 다루는 공개 글 메타데이터. 날짜는 직렬화하기 좋게 `YYYY-MM-DD` 문자열이다.
 * `toc` 는 초안에 있을 때만 있다 — 기본값을 매번 써 넣으면 모든 글의 diff 에 한 줄이 늘어난다.
 */
export type PublicPost = Omit<Post, 'publishedAt' | 'updatedAt' | 'toc'> & {
  readonly publishedAt: string;
  readonly updatedAt: string;
  readonly toc?: Post['toc'];
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

export function parsePublishedPost(input: unknown): PublicPost {
  const { publishedAt, updatedAt, toc, ...rest } = strictPostSchema.parse(input);
  const hasToc = typeof input === 'object' && input !== null && 'toc' in input;
  return {
    ...rest,
    publishedAt: toIsoDate(publishedAt),
    updatedAt: toIsoDate(updatedAt),
    ...(hasToc ? { toc } : {}),
  };
}
```

`apps/workbench/src/core/document/document.ts`:

- 파일 위 import 에 `import { tocSchema } from '@gze1206/content-contract';` 를 더한다.
- `commonSchema` 의 `draft: z.boolean().optional(),` 다음 줄에 `toc: tocSchema.optional(),` 를 넣는다.
- `knownKeys` 의 `'draft',` 다음에 `'toc',` 를 넣는다.
- `kindKeys['public-draft']` 의 `'draft',` 다음에 `'toc',` 를 넣는다.

`apps/workbench/src/core/publishing/validate.ts` 의 `parsePublishedPost({ … })` 호출에서 `draft: document.draft ?? false,` 다음 줄에 추가한다.

```ts
      ...(document.toc === undefined ? {} : { toc: document.toc }),
```

`apps/workbench/src/core/publishing/transform.ts`: 10~21행의 `const postFieldOrder = [...] as const;` 를 지우고 `import { POST_FIELD_ORDER } from '@gze1206/content-contract';` 를 더한 뒤, 42행의 `postFieldOrder` 를 `POST_FIELD_ORDER` 로 바꾼다.

- [ ] **Step 4: 통과 확인**

```bash
pnpm --filter @gze1206/workbench test 2>&1 | grep -E "Test Files|Tests "
pnpm --filter @gze1206/workbench typecheck && pnpm --filter @gze1206/workbench lint
```

Expected: `233 passed`, typecheck·lint 통과. 기존 테스트 `coerces Blog v4 timestamp date inputs…` 가 `2026-08-13`/`2026-08-12` 로 계속 통과해야 한다.

- [ ] **Step 5: green 커밋**

```bash
git add apps/workbench
git commit -m "🐛 fix(workbench): 발행할 때 초안의 toc 를 지킨다 (NOR-195)" \
  -m "글 계약을 content-contract 에서 가져온다. toc 는 초안에 있을 때만 쓴다." \
  -m "TDD: green" -m "Spec: NOR-195 AC-6" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: 회귀 테스트 두 개 (regression)**

같은 `describe('toc'` 안에 추가한다.

```ts
it('NOR-195 AC-6: 초안에 toc 가 없으면 발행 결과에도 쓰지 않는다', () => {
  const result = transformPublicDraft({
    source: validDraft,
    privateRoot: '/srv/private-workbench',
    assets: [],
  });
  expect(result.metadata.toc).toBeUndefined();
  expect(result.source).not.toMatch(/^toc:/mu);
});

it('NOR-195 AC-8: 변환 결과를 블로그 스키마로 다시 읽으면 같은 값이다', () => {
  const result = transformPublicDraft({
    source: tocDraft,
    privateRoot: '/srv/private-workbench',
    assets: [],
  });
  const reread = postSchema.parse(parseFrontmatter(result.source).data);
  expect({
    ...reread,
    publishedAt: reread.publishedAt.toISOString().slice(0, 10),
    updatedAt: reread.updatedAt.toISOString().slice(0, 10),
  }).toEqual(result.metadata);
});
```

파일 위 import 에 `import { postSchema } from '@gze1206/content-contract';` 와 `import { parseFrontmatter } from '../document/frontmatter.js';` 를 더한다.

```bash
pnpm --filter @gze1206/workbench test src/core/publishing
```

Expected: PASS (처음부터 통과 — 회귀 테스트다).

```bash
git add apps/workbench/src/core/publishing/publishing.test.ts
git commit -m "✅ test(workbench): toc 생략과 블로그 스키마 왕복을 지킨다 (NOR-195)" \
  -m "TDD: regression" -m "Spec: NOR-195 AC-6, NOR-195 AC-8" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: 워크벤치의 발행 경로와 기본 브랜치

**Files:**

- Modify: `apps/workbench/src/server/config.ts:31`, `apps/workbench/src/server/adapters/publicBlog.ts:76,219,247,316,327`, `apps/workbench/src/core/import/blogImport.ts:55,128`, `apps/workbench/.env.example`, `apps/workbench/docker-compose.yml`, `apps/workbench/e2e/workbench.spec.ts:171-177`
- Test: `apps/workbench/src/server/config.test.ts:88-89,168`, `apps/workbench/src/server/adapters/publicBlog.test.ts`, `apps/workbench/src/server/adapters/publishOutbox.test.ts`

**Interfaces:**

- Consumes: `BLOG_LAYOUT`, `SLUG_PATTERN` (Task 9)

- [ ] **Step 1: 실패하는 테스트로 기대값을 바꾼다**

세 테스트 파일 위에 `import { BLOG_LAYOUT } from '@gze1206/content-contract';` 를 더하고 다음을 바꾼다.

- `config.test.ts` 88·89·168행의 `'main'` → `BLOG_LAYOUT.publishBranch`. 테스트 이름 앞에 `NOR-195 AC-7: ` 을 붙인다(기본 브랜치를 보는 `it`).
- `publicBlog.test.ts`·`publishOutbox.test.ts` 의 `'src/content/posts'` 문자열을 전부 `BLOG_LAYOUT.postsDir` 로, `'public/assets/posts` 로 시작하는 문자열의 `public` 을 `${BLOG_LAYOUT.publicDir}` 로 바꾼다(템플릿 리터럴로). 예:

```ts
targetPath: (`${BLOG_LAYOUT.postsDir}/safe-publish.mdoc`,
  readFile(
    path.join(consumer, `${BLOG_LAYOUT.publicDir}/assets/posts/safe-publish/images/flow.png`),
    'utf8',
  ),
  await mkdir(path.join(sourceRoot, BLOG_LAYOUT.postsDir), { recursive: true }));
```

가짜 원격 저장소의 `git init -b main` 과 clone 옵션의 `branch: 'main'` 은 테스트 고정 값이므로 그대로 둔다. `publicBlog.test.ts` 에서 발행 경로를 보는 첫 `it` 의 이름 앞에 `NOR-195 AC-7: ` 을 붙인다.

```bash
pnpm --filter @gze1206/workbench test src/server 2>&1 | grep -E "✗|×|FAIL|Tests "
```

Expected: FAIL — config 테스트가 `expected 'main' to be 'v4'`, publicBlog·publishOutbox 테스트가 경로 불일치로 실패.

- [ ] **Step 2: red 커밋**

```bash
git add apps/workbench/src/server
git commit -m "✅ test(workbench): 발행 경로와 기본 브랜치를 블로그 레이아웃에서 기대한다 (NOR-195)" \
  -m "TDD: red" -m "Spec: NOR-195 AC-7" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: 구현**

`config.ts`: `import { BLOG_LAYOUT } from '@gze1206/content-contract';` 를 더하고 31행을 `const DEFAULT_BRANCH = BLOG_LAYOUT.publishBranch;` 로 바꾼다.

`publicBlog.ts`: import 를 더하고 76행을 `const POSTS_DIRECTORY = BLOG_LAYOUT.postsDir;` 로 바꾼다. 219·247행의 `` `public/assets/posts/${…}` `` 를 `` `${BLOG_LAYOUT.publicDir}/assets/posts/${…}` `` 로, 316·327행의 `` `public/${publicPath}` `` 를 `` `${BLOG_LAYOUT.publicDir}/${publicPath}` `` 로 바꾼다. 300행의 URL 경로 `` `assets/posts/${…}` `` 는 그대로 둔다(블로그에서의 URL 이다).

`.env.example`: `PUBLIC_BLOG_BRANCH=main` → `PUBLIC_BLOG_BRANCH=v4`. `docker-compose.yml`: `'${PUBLIC_BLOG_BRANCH:-main}'` → `'${PUBLIC_BLOG_BRANCH:-v4}'`.

`e2e/workbench.spec.ts` 171~177행의 `src/content/posts/` 를 `apps/blog/src/content/posts/`, `public/assets/posts/` 를 `apps/blog/public/assets/posts/` 로 바꾼다.

- [ ] **Step 4: 통과 확인**

```bash
pnpm --filter @gze1206/workbench test 2>&1 | grep -E "Tests "
pnpm --filter @gze1206/workbench typecheck && pnpm --filter @gze1206/workbench lint
pnpm --filter @gze1206/workbench e2e
```

Expected: 전부 통과.

- [ ] **Step 5: green 커밋**

```bash
git add apps/workbench
git commit -m "✨ feat(workbench): 발행 경로와 기본 브랜치를 블로그 레이아웃에서 가져온다 (NOR-195)" \
  -m "TDD: green" -m "Spec: NOR-195 AC-7" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: slug 규칙 중복 제거 (refactor)**

`blogImport.ts` 55행의 `const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;` 를 지우고 `import { SLUG_PATTERN } from '@gze1206/content-contract';` 를 더한 뒤 128행의 `slugPattern` 을 `SLUG_PATTERN` 으로 바꾼다.

```bash
pnpm --filter @gze1206/workbench test src/core/import
git add apps/workbench/src/core/import/blogImport.ts
git commit -m "♻️ refactor(workbench): slug 규칙을 계약에서 가져온다 (NOR-195)" \
  -m "TDD: refactor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: `verify` 에 `spec:check` 를 넣는다**

```bash
pnpm spec:check
```

Expected: `0 unlinked` (AC-10~12 는 manual). 루트 `package.json` 의 `verify` 끝에 `&& pnpm spec:check` 를 붙이고 커밋한다.

```bash
pnpm verify
git add package.json
git commit -m "🔧 chore(infra): 로컬 게이트에 명세 연결 검사를 더한다 (NOR-195)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12A: 블로그 e2e 골격

**Files:**

- Create: `apps/blog/playwright.config.ts`, `apps/blog/e2e/smoke.spec.ts`
- Modify: `apps/blog/package.json`, `apps/blog/eslint.config.mjs`(ignores), `.gitignore`

기존 동작을 지키는 회귀 테스트다. `scripts/verify-*.mjs` 를 이쪽으로 옮기는 일은 하위 프로젝트 2 에서 한다.

- [ ] **Step 1: 설정**

`apps/blog/package.json` devDependencies 에 `"@playwright/test": "^1.62.1"` 을, scripts 에 `"e2e": "playwright test"` 를 넣는다.

`apps/blog/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4321' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // 빌드 산출물을 그대로 띄운다. dev 서버는 draft 를 보여 주므로 프로덕션과 다르다.
  webServer: {
    command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4321',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
```

- [ ] **Step 2: 테스트**

`apps/blog/e2e/smoke.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('홈은 본문 랜드마크와 새 글 링크를 가진다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main#main-content')).toBeVisible();
  await expect(page.locator('a[href^="/blog/"]').first()).toBeVisible();
});

test('글 목록에서 글 상세로 이동한다', async ({ page }) => {
  await page.goto('/blog');
  const first = page.locator('main a[href^="/blog/"]').first();
  const href = await first.getAttribute('href');
  await first.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`, 'u'));
  await expect(page.locator('main h1')).toBeVisible();
});

test('없는 주소는 404 페이지를 보여 준다', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
});
```

`.gitignore` 에 `**/test-results/`, `**/playwright-report/` 를 더하고, `apps/blog/eslint.config.mjs` ignores 에 `'test-results/'`, `'playwright-report/'` 를 더한다.

- [ ] **Step 3: 실행과 커밋**

```bash
pnpm install
pnpm --filter @gze1206/blog exec playwright install chromium
pnpm --filter @gze1206/blog e2e
```

Expected: 3 passed. 선택자가 실제 마크업과 다르면 `apps/blog/src/pages/index.astro`·`blog/[...page].astro` 를 열어 맞춘다(마크업은 바꾸지 않는다).

```bash
git add apps/blog .gitignore pnpm-lock.yaml
git commit -m "✅ test(blog): 빌드 산출물을 띄워 보는 e2e 골격을 둔다 (NOR-195)" \
  -m "TDD: regression" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

`TDD: regression` 커밋의 e2e 파일은 `tdd-evidence` 대상(`*.test.*`)이 아니므로 검사에 영향이 없다.

---

### Task 13: 워크벤치 arm64 이미지

**Files:**

- Modify: `apps/workbench/Dockerfile`(전체 교체), `apps/workbench/package.json`(build 스크립트)
- Create: `apps/workbench/tsup.config.ts`, `.dockerignore`(루트)
- Delete: `apps/workbench/.dockerignore`

- [ ] **Step 1: tsup 설정 — 계약을 번들에 넣는다**

`apps/workbench/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist/server',
  clean: false,
  // 워크스페이스 패키지는 TS 소스를 내보낸다. 런타임 Node 는 node_modules 안의 TS 를 읽지 않으므로
  // 서버 번들에 넣는다. 그래서 이미지에는 이 패키지가 필요 없다.
  noExternal: ['@gze1206/content-contract'],
});
```

`apps/workbench/package.json` 의 build 스크립트를 `"tsc -b && vite build && tsup"` 로 바꾼다.

```bash
pnpm --filter @gze1206/workbench build
grep -c "content-contract" apps/workbench/dist/server/index.js
```

Expected: 빌드 성공, `0` (import 문이 남지 않고 인라인됐다).

- [ ] **Step 2: 루트 `.dockerignore`**

```gitignore
**/node_modules
**/dist
**/.astro
**/test-results
**/playwright-report
.git
docs
apps/blog/*
!apps/blog/package.json
.env
**/.env
```

블로그는 `package.json` 만 들어간다(lockfile 의 importer 를 맞추기 위해서다).

- [ ] **Step 3: `apps/workbench/Dockerfile`**

```dockerfile
# 저장소 루트를 빌드 컨텍스트로 쓴다:
#   docker buildx build --platform linux/arm64 -f apps/workbench/Dockerfile .
ARG NODE_VERSION=26

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /repo
# Node 25 부터 corepack 이 빠졌다. packageManager 필드의 pnpm 을 그대로 설치한다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN npm install --global "$(node -p "require('./package.json').packageManager")"
COPY apps/blog/package.json apps/blog/
COPY apps/workbench/package.json apps/workbench/
COPY packages/config/package.json packages/config/
COPY packages/content-contract/package.json packages/content-contract/
COPY packages/repo-tools/package.json packages/repo-tools/
RUN pnpm install --frozen-lockfile --filter "@gze1206/workbench..."
COPY packages/config packages/config
COPY packages/content-contract packages/content-contract
COPY apps/workbench apps/workbench
RUN pnpm --filter @gze1206/workbench build \
  && pnpm --filter @gze1206/workbench --prod deploy --legacy /out

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 10001 workbench \
  && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin workbench
ENV HOME=/home/workbench
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=build --chown=10001:10001 /out ./
USER 10001:10001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(async response => { if (!response.ok || (await response.json()).status !== 'ready') process.exit(1) }).catch(() => process.exit(1))"]
CMD ["node", "dist/server/index.js"]
```

`/out` 에는 `package.json`, `files` 로 지정한 `dist`·`workspace-seed`, prod `node_modules` 만 있다. 기존 이미지의 `/app` 배치(`dist/`, `workspace-seed/`, `node_modules/`)와 같다.

```bash
git rm apps/workbench/.dockerignore
```

- [ ] **Step 4: 로컬 arm64 빌드와 부팅 확인 (AC-11)**

```bash
docker buildx build --platform linux/arm64 -f apps/workbench/Dockerfile -t workbench:local --load .
docker image ls workbench:local --format '{{.Size}}'
WS=$(mktemp -d) && git -C "$WS" init -q && printf '.workbench/publish-outbox\n' > "$WS/.gitignore"
docker run -d --name wb-smoke --network host -v "$WS:/data/workspace" \
  -e WORKSPACE_ROOT=/data/workspace -e APP_TIME_ZONE=Asia/Seoul \
  -e PUBLIC_BLOG_REMOTE=https://github.com/gze1206/blog.gze1206.net \
  -e PUBLISH_GIT_AUTHOR_NAME=Smoke -e PUBLISH_GIT_AUTHOR_EMAIL=smoke@example.com \
  --tmpfs /run/publish --user "$(id -u):$(id -g)" workbench:local
sleep 5; docker exec wb-smoke node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)"
docker logs wb-smoke | tail -5; docker rm -f wb-smoke; rm -rf "$WS"
```

Expected: 이미지 크기 출력(기존 510MB 와 비교해 PR 에 적는다), `{"status":"ready"}`. 부팅에 실패하면 로그의 설정 오류 메시지를 보고 환경 변수를 맞춘다(macOS 의 host network 는 OrbStack VM 안이므로 `docker exec` 로 확인한다).

- [ ] **Step 5: 커밋**

```bash
git add .dockerignore apps/workbench
git commit -m "👷 ci(workbench): 모노레포에서 arm64 이미지를 빌드한다 (NOR-195)" \
  -m "계약 패키지는 서버 번들에 인라인한다. Node 26 이미지에는 corepack 이 없어 packageManager 의 pnpm 을 설치한다." \
  -m "Spec: NOR-195 AC-11" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: GitHub Actions

**Files:**

- Create: `.github/workflows/ci.yml`, `.github/workflows/workbench-image.yml`

- [ ] **Step 1: `ci.yml`**

```yaml
name: ci

on:
  pull_request:
  push:
    branches: [v4, master]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with: { fetch-depth: 0 }
      - uses: jdx/mise-action@v5
      - run: pnpm install --frozen-lockfile
      # 변경 영향 범위만 돈다. 계약은 두 앱이 모두 의존하므로 바뀌면 둘 다 돈다.
      - name: verify (affected)
        env:
          BASE: ${{ github.event_name == 'pull_request' && format('origin/{0}', github.base_ref) || github.event.before }}
        run: |
          F="...[${BASE}]"
          pnpm --filter "$F" --if-present typecheck
          pnpm --filter "$F" --if-present lint
          pnpm format:check
          pnpm --filter "$F" --if-present test
          pnpm --filter "$F" --if-present build
          pnpm boundaries
      # 계약 테스트는 영향 범위와 무관하게 항상 돈다.
      - run: pnpm --filter @gze1206/content-contract test

  e2e:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: jdx/mise-action@v5
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @gze1206/workbench exec playwright install --with-deps chromium
      - run: pnpm --filter @gze1206/workbench build
      # 블로그 e2e 는 playwright.config.ts 의 webServer 가 직접 빌드한다.
      - run: pnpm e2e

  spec-check:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: jdx/mise-action@v5
      - run: pnpm spec:check

  tdd-evidence:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with: { fetch-depth: 0 }
      - uses: jdx/mise-action@v5
      - run: pnpm tdd:evidence --base origin/${{ github.base_ref }}
```

- [ ] **Step 2: `workbench-image.yml`**

기존 `personal-workbench/.github/workflows/publish-image.yml` 의 구조(verify 후 publish, digest 요약)를 따르되 다음을 바꾼다.

````yaml
name: workbench-image

on:
  push:
    branches: [master]
    tags: ['workbench-v*']
    paths:
      - 'apps/workbench/**'
      - 'packages/content-contract/**'
      - 'packages/config/**'
      - 'pnpm-lock.yaml'
      - 'pnpm-workspace.yaml'
      - 'package.json'
      - '.dockerignore'
      - '.github/workflows/workbench-image.yml'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: workbench-image-${{ github.ref }}
  cancel-in-progress: true

env:
  IMAGE_NAME: ghcr.io/${{ github.repository_owner }}/personal-workbench

jobs:
  publish:
    # 대상 호스트가 arm64 다. 에뮬레이션 대신 arm64 러너에서 네이티브로 빌드한다.
    runs-on: ubuntu-24.04-arm
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v7
      - uses: jdx/mise-action@v5
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter "@gze1206/workbench..." test
      - run: pnpm --filter @gze1206/workbench build
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v6
        with:
          images: ${{ env.IMAGE_NAME }}
          tags: |
            type=match,pattern=workbench-v(.*),group=1
            type=sha,format=long
            type=raw,value=edge,enable={{is_default_branch}}
      - id: build
        uses: docker/build-push-action@v7
        with:
          context: .
          file: apps/workbench/Dockerfile
          platforms: linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          provenance: mode=max
          sbom: true
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: 배포용 digest 를 요약에 남긴다
        run: |
          {
            echo '## 배포용 이미지 참조'
            echo
            echo '호스트 `.env` 의 `IMAGE_DIGEST` 에 아래 값을 넣고 `docker compose pull && docker compose up -d` 한다.'
            echo
            echo '```'
            echo 'IMAGE_DIGEST=${{ steps.build.outputs.digest }}'
            echo '```'
          } >> "$GITHUB_STEP_SUMMARY"
````

공개 저장소이므로 provenance 를 위해 `actions/attest-build-provenance` 를 쓸 수 있게 됐다. 이 계획에서는 기존 buildx provenance·SBOM 만 유지하고, attestation 추가는 하위 프로젝트 3 에서 정한다.

- [ ] **Step 3: 로컬 문법 확인과 커밋**

```bash
pnpm dlx @action-validator/cli .github/workflows/ci.yml .github/workflows/workbench-image.yml
git add .github
git commit -m "👷 ci(infra): 모노레포 CI 와 워크벤치 arm64 이미지 게시를 만든다 (NOR-195)" \
  -m "Spec: NOR-195 AC-12" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: validator 오류 없음. (`@action-validator/cli` 를 쓸 수 없으면 `gh workflow view` 는 push 후에만 되므로, Task 16 의 PR CI 결과로 확인한다.)

---

### Task 15: 문서·ADR

**Files:**

- Create: `docs/decisions/0017-monorepo-with-workbench.md`, `docs/decisions/0018-workbench-architecture-decisions.md`
- Modify: `AGENTS.md`, `README.md`, `docs/conventions/{workflow,coding,commits,branch-pr}.md`, `docs/decisions/README.md`, `docs/spec/README.md`, `docs/README.md`

- [ ] **Step 1: ADR 0017 — 모노레포**

`docs/decisions/_template.md` 형식으로 쓴다. 맥락(계약 어긋남·`main` 브랜치·책 경로 부재), 대안(A 공개 저장소 모노레포 / B 새 private 모노레포 / C 워크벤치 쪽으로), 결정 A, 근거(개인 기록은 WORKSPACE_ROOT 에 있어 코드에 비밀 없음, 스냅샷 이관으로 private 이력 비공개), 영향(Cloudflare 빌드 루트 `apps/blog`, 발행 경로 `apps/blog/src/content/posts`, 워크벤치 원본 저장소 archive). `related: [NOR-195]`. ADR 0016 은 superseded 가 아니다(작성 경계 결정은 유지된다) — 본문에서 "0016 의 '저장소 분리' 서술을 이 ADR 이 개정한다"고 적는다.

- [ ] **Step 2: ADR 0018 — 워크벤치 결정 D1~D6 이관**

`docs/spec/workbench/2026-08-12-personal-workbench-architecture.md` §12 의 D1~D6 을 한 ADR 에 옮긴다. D1 은 "앱 코드 ①은 공개 블로그 ③과 같은 저장소에 산다(ADR 0017). 개인 기록 ②의 분리는 유지한다"로 개정해 적는다. 원 스펙 §12 에는 "ADR 0018 로 옮겼다" 한 줄을 남긴다.

- [ ] **Step 3: 규약 갱신**

- `AGENTS.md`: 저장소 설명을 모노레포로, "빌드/검증" 절을 실제 루트 스크립트(`pnpm verify`, `pnpm dev:blog`, `pnpm dev:workbench`, `pnpm spec:check`, `pnpm tdd:evidence --base origin/v4`)로 바꾸고 "Phase 0 이후 확정" 문구를 지운다. 핵심 원칙에 "명세 → red → green 커밋, trailer 표기", "전체 작업 마무리 직전 Claude·Codex 병렬 보안 검수 1회"를 더한다.
- `docs/conventions/workflow.md`: TDD 절에 AC id 규칙(`- **AC-n**`, `(manual)`), 테스트 이름 규칙(`NOR-N AC-n:`), trailer 규칙, `tdd-evidence` 의 판정(단언 실패·모듈 없음 = red, 통과·문법 오류 = 거부)을 적는다. spec 위치를 `docs/spec/<blog|workbench|contract|repo>/` 로 바꾼다.
- `docs/conventions/commits.md`: 푸터 절에 `TDD:`·`Spec:` trailer 를 더한다. scope 예시에 `workbench`, `contract` 를 더한다.
- `docs/conventions/coding.md`: 디렉터리 구조를 모노레포로, 린트·포맷 명령을 실제 값으로, "스캐폴딩 후 확정" 문구를 지운다. 의존 방향 규칙과 `pnpm boundaries` 를 적는다.
- `README.md`: 모노레포 구성과 시작 명령, 작성 경계(ADR 0016·0017 링크).
- `docs/decisions/README.md`·`docs/spec/README.md`·`docs/README.md`: 새 ADR 과 spec 하위 디렉터리를 목록에 넣는다.

- [ ] **Step 4: 링크 검사와 커밋**

```bash
grep -rnoE '\]\((\.\.?/[^)#]+)' docs AGENTS.md README.md | while IFS=: read -r file _ link; do
  target="$(dirname "$file")/${link#](}"; [ -e "$target" ] || echo "BROKEN $file -> $target"; done
pnpm format:check
git add docs AGENTS.md README.md
git commit -m "📝 docs(infra): 모노레포 결정과 SDD/TDD 규약을 문서에 반영한다 (NOR-195)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: `BROKEN` 출력 없음.

---

### Task 16: 최종 검증·셀프 리뷰·PR

- [ ] **Step 1: 전체 게이트**

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install --frozen-lockfile
pnpm verify && pnpm e2e && pnpm tdd:evidence --base v4
```

Expected: 모두 통과. `tdd-evidence` 는 Task 6·7·8·9·10·11·12 의 red 커밋 7개를 `✓` 로 보고한다.

- [ ] **Step 2: 셀프 리뷰 루프**

`git diff v4...HEAD` 를 [workflow.md 셀프 리뷰 루프](../../conventions/workflow.md#셀프-리뷰-루프-pr-전-필수) 관점으로 읽는다. `/code-review` 를 돌리고, 지적을 고친 뒤 Step 1 을 다시 통과시킨다. 지적이 없을 때까지 반복한다.

- [ ] **Step 3: 공개 검수 재확인**

Task 4 의 Step 6·7 을 브랜치 전체(`git diff v4...HEAD --name-only` 의 파일)에 다시 돌린다.

- [ ] **Step 4: push 와 PR (사용자 확인 후)**

사용자에게 "공개 저장소에 `feat/nor-195-monorepo-foundation` 를 push 하고 `v4` 로 PR 을 열어도 되는지" 확인한다. 승인되면:

```bash
git push -u origin feat/nor-195-monorepo-foundation
gh pr create --base v4 --title "🎉 feat(infra): 모노레포 기반과 SDD/TDD 환경 (NOR-195)" --body-file <(cat <<'EOF'
## 관련 일감
- NOR-195

## 변경 요약
- 블로그를 apps/blog 로 옮기고(dist 바이트 동일), personal-workbench 스냅샷(8453402)을 apps/workbench 로 들였다.
- 글·시리즈 계약을 @gze1206/content-contract 로 단일화했다. 워크벤치가 toc 를 잃던 버그와 main 기본 브랜치를 고쳤다.
- repo-tools: 경계 검사·명세 연결 검사·red→green 증거 검사.
- Node 26·TS 6.0.3·공통 ESLint/Prettier, CI 와 arm64 이미지 게시.

## 공개 전 검수
(Task 4 Step 8 의 $BASE/audit.md 내용을 붙인다)

## 완료 조건
- [ ] pnpm verify / e2e / tdd-evidence 통과
- [ ] 블로그 dist 바이트 비교 (이동 후, 계약 적용 후)
- [ ] arm64 이미지 health ready, 이미지 크기: (Task 13 Step 4 값)
- [ ] CI 4개 job 통과

## 설계와 달라진 점
(이 계획의 "설계와 달라진 점" 표)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)
```

- [ ] **Step 5: PR CI 확인**

```bash
gh pr checks --watch
```

Expected: `verify`, `e2e`, `spec-check`, `tdd-evidence` 통과(AC-12). 실패하면 로그를 읽고 같은 브랜치에서 고친다.

- [ ] **Step 6: 남은 외부 조치 (각각 사용자 확인 후)**

- `personal-workbench` 저장소 archive: `gh repo archive gze1206/personal-workbench`
- GHCR 패키지 `personal-workbench` 의 "Manage Actions access" 에 `blog.gze1206.net` 추가(웹 UI. 사용자에게 안내)
- `v4`·`master` ruleset 으로 필수 check 지정
- Linear 일감에 PR 링크 첨부: `orca linear attach --current --url <PR-URL> --title "PR link" --json`
