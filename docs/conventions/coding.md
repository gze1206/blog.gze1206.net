# 코딩 컨벤션

## 언어·타입

- **TypeScript strict**(TypeScript 6.0.3 고정). `any` 지양, 불가피하면 주석으로 이유 명시.
  - `packages/*` 는 `@gze1206/config/tsconfig.base.json`(`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`)을 상속한다.
  - 워크벤치는 자기 tsconfig 에 같은 세 옵션을 켠다. 블로그는 `astro/tsconfigs/strict` 를 쓰며, 나머지 두 옵션 적용은 하위 프로젝트 2(NOR-197)에서 한다.
- 콘텐츠 데이터는 항상 **Content Collections(zod) 스키마**를 통해 타입 안전하게 다룹니다. 필드를 바꿀 땐 코드가 아니라 **스키마부터** 수정(NOR-9).
- 글·시리즈 스키마는 `@gze1206/content-contract` 에만 둔다. 블로그(`postSchema`)와 워크벤치 발행기(`strictPostSchema`)가 같은 객체에서 파생하므로, 필드는 계약 패키지에서 한 번만 고친다. 블로그에만 쓰이는 스키마(portfolio·profile·experience 등)는 `apps/blog/src/content/schemas.ts` 에 남는다.

## 디렉토리 구조

pnpm 워크스페이스(`pnpm-workspace.yaml` 의 `apps/*`, `packages/*`) 모노레포다([ADR 0017](../decisions/0017-monorepo-with-workbench.md)).

```
apps/
  blog/                 # @gze1206/blog: Astro 정적 블로그 (Cloudflare 빌드 루트)
    src/
      content/          # Content Collections (posts·series·portfolio·books·experience) + 블로그 전용 스키마
      components/       # 정적 Astro 컴포넌트 (.astro)
      layouts/          # 페이지 레이아웃
      islands/          # 인터랙티브 아일랜드 (React/Three.js 등, client:* 로 격리)
      pages/            # 라우트
      styles/           # Tailwind 진입점·전역
      lib/              # 렌더·OG·검색 등 빌드 유틸
    public/             # 정적 에셋
    e2e/                # Playwright (빌드 산출물 대상)
  workbench/            # @gze1206/workbench: private Tailnet 작성 도구
    src/core/           # 순수 도메인 (I/O 없음)
    src/server/         # Hono 라우트 + 어댑터 (파일·Git·public clone)
    src/web/            # React 클라이언트
    e2e/                # Playwright
    Dockerfile          # linux/arm64 이미지 (빌드 컨텍스트는 저장소 루트)
packages/
  content-contract/     # @gze1206/content-contract: 글·시리즈 스키마, slug 규칙, BLOG_LAYOUT (zod 는 peerDependency)
  config/               # @gze1206/config: tsconfig.base.json, ESLint flat config 베이스
  repo-tools/           # @gze1206/repo-tools: boundaries·spec:check·tdd:evidence 검사기
docs/                   # 저장소 공통 계획·규약·ADR·spec (루트에 하나만 둔다)
```

- 공용 의존성(typescript, zod, vitest, react, tailwindcss, eslint 등)의 버전은 `pnpm-workspace.yaml` 의 `catalog` 에서 한 곳에 관리하고, 각 패키지는 `"catalog:"` 로 참조한다.
- Node·pnpm 버전은 루트 `mise.toml`(Node 26, pnpm 12.18.0)과 `packageManager` 필드가 단일 출처다.
- **인터랙티브 요소는 `islands/` 로 격리**하고 `client:visible` / `client:idle` 등으로 지연 로드. 정적 컴포넌트에 클라이언트 JS를 섞지 않는다.
- 라우트별 로직은 `pages/` 최소화, 재사용 로직은 `components/`·유틸로.

## 의존 방향

- `apps/*` 는 `packages/*` 만 import 한다. 앱끼리 import 하지 않는다.
- `packages/*` 는 `apps/*` 를 import 하지 않는다. 패키지끼리는 import 할 수 있다.
- `pnpm dead-exports` 는 블로그의 미사용 export 와 미사용 모듈을 검사한다.
- `pnpm boundaries` 가 이 규칙을 검사한다. 각 패키지의 `.ts`·`.tsx`·`.mts`·`.mjs`·`.js`·`.astro` 파일에서 import·export·`import()` 문자열을 읽고(`node_modules`·`dist`·`.astro`·`test-results`·`playwright-report` 디렉터리는 건너뛴다) 두 경우를 위반으로 보고한다.
  - 상대 경로 import 를 풀었을 때 자기 패키지 디렉터리를 벗어난다(예: `../../workbench/src/…`).
  - 다른 앱의 패키지 이름(`@gze1206/blog`, `@gze1206/workbench`, 하위 경로 포함)을 import 한다.
- 워크스페이스 패키지는 빌드 없이 TS 소스를 `exports` 로 내보낸다. 블로그는 Astro(Vite)가 바로 읽고, 워크벤치 서버는 tsup 이 `@gze1206/content-contract` 를 번들에 넣는다(`noExternal`). 그래서 워크벤치 이미지에는 워크스페이스 패키지가 필요 없다.

## 린트·포맷

- **ESLint + Prettier + `.editorconfig`**. 커밋 전 로컬에서 통과시킬 것.
- ESLint 는 패키지마다 flat config 를 두고 `@gze1206/config/eslint` 의 `base`(`@eslint/js` recommended + `typescript-eslint` strict)를 펼친 뒤 자기 플러그인을 덧붙인다. 블로그는 `eslint-plugin-astro`(+ jsx-a11y), 워크벤치는 react-hooks·react-refresh. 마지막에 `prettierLast`(`eslint-config-prettier`)를 둔다.
- Prettier 는 루트 `.prettierrc` 하나이고, 무시 목록은 `.prettierignore` 다.
- 명령(저장소 루트):
  - `pnpm lint`: 패키지마다 `eslint .`
  - `pnpm format:check`: `prettier --check .`
  - `pnpm format`: `prettier --write .`
  - `pnpm typecheck`: 블로그 `astro check`, 워크벤치·패키지 `tsc`

## 테스트

- 단위·통합 테스트는 Vitest 5 다. 루트 `pnpm test` 는 `pnpm -r --if-present test` 로 패키지마다 **자기 디렉터리에서** 돈다. 블로그 코드가 `process.cwd()` 기준 경로를 쓰기 때문이다.
- 블로그 Vitest 는 `e2e/**` 를 제외한다(`vitest run --exclude e2e/**`). 블로그 e2e 는 Playwright(`pnpm e2e`)의 두 프로젝트로 돌며, 프로덕션 빌드와 `BLOG_SMOKE=1` 빌드를 각각 별도 preview 서버로 검사한다. smoke 페이지는 개발 서버와 `BLOG_SMOKE=1` 빌드에서만 생성된다.
- 워크벤치 Vitest 는 `src/**/*.test.{ts,tsx}` 만 돈다. 워크벤치 e2e 는 빌드된 `dist/web` 을 띄우므로 먼저 워크벤치를 빌드한다.
- 커버리지는 `pnpm coverage`(v8 provider). 지금은 리포트만 남긴다.
- 수용 기준과의 연결(테스트 이름 `NOR-N AC-n:`)과 red→green 규칙은 [workflow.md](./workflow.md#tdd).

## CI

GitHub Actions 두 개가 있다.

| workflow              | 언제                                                                                              | 하는 일                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`              | PR, `v4`·`main` push                                                                              | `verify`: 변경 영향 범위(`--filter "...[<base>]"`)에 typecheck·lint·test·build, 전체 `format:check`·`boundaries`, 계약 테스트는 항상. PR 에서만 `e2e`(블로그·워크벤치 Playwright)·`spec-check`·`tdd-evidence` |
| `workbench-image.yml` | `main` push(워크벤치·계약·config·lockfile 등 관련 경로가 바뀔 때), `workbench-v*` 태그, 수동 실행 | `ubuntu-24.04-arm` 러너에서 워크벤치 테스트·빌드 후 linux/arm64 이미지를 GHCR(`workbench`)에 게시하고, 배포용 digest 를 실행 요약에 남긴다                                                                    |

- CI 와 로컬 모두 `mise.toml` 의 Node·pnpm 을 쓴다.
- 이미지를 호스트에 배포하는 절차(OCI 호스트, 리버스 프록시)는 후속 하위 프로젝트(NOR-198, NOR-200)에서 정한다.

## 네이밍

- 컴포넌트 파일: `PascalCase.astro` / `PascalCase.tsx`.
- 유틸·모듈: `kebab-case.ts`.
- 콘텐츠 슬러그: **영문 kebab-case** (posts는 영문 slug 규약 — NOR-9).
- 변수·함수: `camelCase`, 상수: `UPPER_SNAKE_CASE`, 타입/인터페이스: `PascalCase`.

## 성능 기본기

- 이미지는 Astro `<Image>`(AVIF/WebP·반응형·lazy) 사용(NOR-14). 원본 `<img>` 남발 금지.
- 클라이언트 번들 최소화 — 무거운 라이브러리(Three.js/Phaser/Mermaid 등)는 아일랜드 + 지연 로드.
- CLS 유발 요소(수식·다이어그램·임베드)는 자리 예약으로 레이아웃 안정화(NOR-13).

## 커밋 전 체크

1. `pnpm verify` 통과: `typecheck` → `lint` → `format:check` → `test` → `build` → `boundaries` → `dead-exports` → `spec:check` 순서로 돈다.
2. 화면이나 서버 동작을 바꿨다면 `pnpm e2e` 통과.
3. 관련 일감 완료 조건 충족.

## 관련 문서

- 접근성·SEO·콘텐츠: [content-a11y-seo.md](./content-a11y-seo.md)
- 커밋/브랜치: [commits.md](./commits.md) · [branch-pr.md](./branch-pr.md)

## 콘텐츠 스키마를 고친 뒤

Astro 의 콘텐츠 저장소(`apps/blog/node_modules/.astro/data-store.json`)는 **파일이 바뀔 때만** 다시
파싱한다. 스키마(`packages/content-contract/src/post.ts` 나 `apps/blog/src/content/schemas.ts`)에 필드를 추가해도 기존 항목은 그 값이 비어 있는
채로 남고, 빌드가 그 자리에서 죽는다. 스키마를 고쳤다면 한 번 지우고 빌드한다.

```
rm -f apps/blog/node_modules/.astro/data-store.json && pnpm --filter @gze1206/blog build
```

스키마 파일이 `content.config.ts` 와 분리돼 있어(ADR 0002) 설정 파일의 해시가 바뀌지 않기
때문이다.
