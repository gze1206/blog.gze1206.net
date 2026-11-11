# 모노레포 기반과 SDD/TDD 환경 설계

- Linear: [NOR-194](https://linear.app/noru-kim/issue/NOR-194) (상위), 1a [NOR-195](https://linear.app/noru-kim/issue/NOR-195), 1b NOR-196, 2 NOR-197, 3 NOR-198, 4 NOR-199, 5 NOR-200
- 상태: 섹션별 사용자 승인 완료, 구현 계획 작성 전
- 작성일: 2026-11-12
- 범위: 아래 "하위 프로젝트" 중 **1번**. 나머지는 각자 별도의 설계 → 계획 → 구현 주기를 밟는다.

## 배경

공개 블로그(`blog.gze1206.net`, public)와 개인 작성 도구(`personal-workbench`, private)는 따로
개발되어 왔다. 2026-11-12 분석에서 다음 문제가 확인됐다.

1. **발행 계약 어긋남.** 블로그 `postSchema` 에는 `toc` 필드가 있는데(NOR-150), 워크벤치의 복제본은
   `.strict()` 이면서 `toc` 가 없다. 워크벤치는 `toc` 가 있는 글을 발행하지도, 가져오지도 못한다.
2. **발행 대상 브랜치 불일치.** 워크벤치 기본값은 `main` 인데 블로그 저장소에는 `master` 와 `v4` 만 있다.
3. **책 공개 경로 부재.** NOR-189 는 "읽은 목록은 블로그로 나갈 수 있다"고 정했지만 내보내는 길이 없다.
   NOR-188 은 `cover` 형태 차이(경로 문자열 ↔ `{ src, width, height, source }`)를 남은 간극으로 적어 뒀다.
4. **검증 공백.** 블로그에는 CI, `.astro` 타입 검사, e2e 가 없다. SDD/TDD 흐름은 문서 규약으로만 존재한다.
5. **draft 노출.** `/smoke/*` 페이지가 draft 글을 `getEntry` 로 직접 렌더링해 프로덕션 산출물에 들어간다.
6. **배포 대상 변경.** 워크벤치와 댓글 서버는 OCI Ampere 인스턴스(linux/arm64, vCPU 1, 다른 서비스와 공유)로
   옮긴다. 현재 워크벤치 이미지는 amd64 전용이다.

## 확정한 결정

| 결정      | 내용                                                                           | 근거                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 저장소    | `blog.gze1206.net`(public) 을 pnpm 모노레포로 바꾸고 워크벤치를 합친다         | GitHub 이력·Cloudflare 연동 유지. 개인 기록은 별도 저장소(WORKSPACE_ROOT)에 있어 코드에는 비밀이 없다                                                                                  |
| 이관 방식 | 워크벤치는 **스냅샷 한 커밋**으로 가져온다. 원본은 private archive 로 보존한다 | private 이력 60커밋이 그대로 공개되는 위험을 피한다. 현재 트리만 검수하면 된다                                                                                                         |
| 배치      | `apps/` + `packages/` 표준 배치                                                | 계약 단일화와 설정 상속 경계를 구조로 강제한다                                                                                                                                         |
| 언어      | 블로그·워크벤치 모두 TypeScript 유지                                           | 정적 HTML 이라 런타임 성능은 생성기와 무관하다. Go/Ruby 로 옮기면 CIL 하이라이팅·Markdoc·테스트 388건을 다시 만들어야 하고 계약 공유를 잃는다. OCI 인스턴스에서 메모리는 제약이 아니다 |
| 성능 개선 | 언어 교체 대신 실측으로 병목을 찾는다                                          | 대상: Mermaid 500KB 청크, 워크벤치 이미지 크기, 댓글 서버 자원                                                                                                                         |
| CI        | GitHub Actions                                                                 | 공개 저장소의 arm64 러너로 워크벤치 이미지를 네이티브 빌드할 수 있다                                                                                                                   |

WORKSPACE_ROOT(개인 기록 저장소)는 모노레포에 합치지 않는다. 아직 만들어지지 않았으며 하위 프로젝트 3에서
새 private 저장소로 만든다.

## 하위 프로젝트

| #   | 하위 프로젝트                                                                    | 이 문서         |
| --- | -------------------------------------------------------------------------------- | --------------- |
| 1   | 모노레포 + 공유 계약 + 툴체인 + SDD/TDD·CI                                       | **여기서 설계** |
| 2   | 블로그 체계적 개선 (draft 노출, 엄격 TS 옵션, e2e, `src/lib` 정리, Mermaid 청크) | 별도            |
| 3   | 워크벤치 OCI 배포 (arm64 이미지, WORKSPACE_ROOT 생성, Tailscale Serve)           | 별도            |
| 4   | 블로그 공개 배포와 도메인 (Cloudflare 또는 OCI, `publishBranch` 확정)            | 별도            |
| 5   | 댓글 서버 교체 (Comentario 또는 Artalk, OCI 에서 실측 후 선택)                   | 별도            |

1번이 나머지 전부의 바탕이므로 먼저 한다. 1번은 구현 계획을 둘로 나눈다.

- **1a — 기반:** §1 구조, §3 툴체인, §4 SDD/TDD·CI, §5 이관, §2 중 글 계약(`postSchema`·`seriesSchema`·
  `POST_FIELD_ORDER`·`BLOG_LAYOUT`)과 `toc` 버그 수정.
- **1b — 책 공개와 인용:** §2 의 `bookSchema`·`PUBLIC_BOOK_FIELDS`·`toPublicBook`·`bookquote`. 1a 위에서 진행한다.

---

## 1. 저장소 구조와 패키지 경계

```text
blog.gze1206.net/  (public)
├─ apps/
│  ├─ blog/                 Astro 정적 사이트 (현재 루트의 블로그 전체)
│  └─ workbench/            Vite+React 클라이언트 + Hono 서버 → Docker 이미지
├─ packages/
│  ├─ content-contract/     글·시리즈·책 스키마, slug 규칙, 블로그 레이아웃 상수 (zod 만 의존)
│  └─ config/               tsconfig 베이스, ESLint flat config, Prettier 설정
├─ deploy/oci/              워크벤치·댓글 서버 compose, 리버스 프록시 설정 조각
├─ docs/                    저장소 공통 ADR·규약·로드맵·spec
└─ .github/workflows/       ci.yml, workbench-image.yml
```

### 의존 방향

- `apps/*` 는 `packages/*` 만 import 한다. 앱끼리 import 하지 않는다.
- `packages/*` 는 `apps/*` 를 import 하지 않는다.
- 이 규칙은 ESLint `no-restricted-imports` 로 강제한다(§3).
- `content-contract` 는 Astro·Node API 를 모르는 순수 패키지다. `zod` 는 peerDependency 로 두어 각 앱의
  zod 인스턴스를 쓴다.

### 문서 배치

- `docs/` 는 루트에 하나만 둔다.
- 워크벤치 아키텍처 스펙의 결정 D1~D6 은 ADR 0017 이후 번호로 옮긴다. 세 저장소 경계(D1)는 "앱 코드 ①이
  공개 블로그 ③과 같은 저장소에 산다"로 개정하고, 개인 기록 ②의 분리는 그대로 유지한다.
- 앱별 spec 은 `docs/spec/blog/`, `docs/spec/workbench/`, `docs/spec/contract/` 로 나눈다. 기존
  `docs/spec/NOR-*.md` 는 `docs/spec/blog/` 로 옮긴다.
- 워크벤치의 `docs/_temp/work-reports/` 는 이관하지 않는다.

### 빌드 도구

- Turborepo·Nx 는 도입하지 않는다. `pnpm -r`, `pnpm --filter` 로 충분하다.
- CI 는 `--filter "...[<base>]"` 로 변경된 패키지와 그것에 의존하는 앱만 검증한다.
- 빌드 시간이 실제 병목이 되면 다시 검토한다.

### 배포 단위

- 블로그: `apps/blog` 를 빌드 루트로 하는 정적 산출물. 호스팅은 하위 프로젝트 4에서 정한다.
- 워크벤치: `linux/arm64` 이미지를 GHCR(`ghcr.io/gze1206/personal-workbench`, 이름 유지)에 게시하고
  digest 로 고정해 배포한다.

## 2. `content-contract` 인터페이스

### 내보내는 것

```ts
export const SLUG_PATTERN: RegExp;
export const postSchema;          // 블로그 글 frontmatter 의 단일 정의 (toc 포함)
export const seriesSchema;
export const POST_FIELD_ORDER;    // 직렬화 키 순서 (toc 포함)
export const bookSchema;          // 블로그가 렌더링하는 공개 책 항목
export const PUBLIC_BOOK_FIELDS;  // 공개 허용 필드 목록
export const bookquoteTag;        // bookquote Markdoc 태그의 속성 스키마
export const BLOG_LAYOUT: {
  postsDir: 'apps/blog/src/content/posts';
  postAssetsDir: (slug: string) => string;   // apps/blog/public/assets/posts/<slug>
  booksDir: 'apps/blog/src/content/books';
  bookCoversDir: 'apps/blog/src/assets/books';
  publishBranch: string;                     // 하위 프로젝트 4에서 확정한 값으로 채운다
};
export type Post, Series, PublicBook;
```

- 블로그에만 쓰이는 `portfolio`, `profile`, `experience` 스키마는 블로그에 남긴다. 워크벤치가 쓰게 되는
  시점에 옮긴다.
- `publishBranch` 는 하위 프로젝트 4 전까지 현재 통합 브랜치 `v4` 로 둔다. 워크벤치 설정의 기본값은 이
  상수를 따른다.

### 검증 강도

- 블로그는 `postSchema` 를 그대로 쓴다. 모르는 필드가 있어도 빌드가 깨지지 않는 현재 동작을 유지한다.
- 워크벤치 발행기는 `postSchema.strict()` 를 쓴다. 오타 필드의 발행을 막는다.
- 두 강도가 같은 객체에서 파생되므로 필드 추가는 양쪽에 동시에 반영된다.

### 책 공개

- **책 id** 는 워크벤치 책 문서의 식별자를 그대로 쓴다: `isbn13` 이 있으면 그것, 없으면 `bookSlug`(한글 유지).
  블로그 책 파일명(`booksDir/<책 id>.json`)과 `bookquote` 의 `book` 속성도 같은 값이다.
- 공개 범위는 **허용 목록**(`PUBLIC_BOOK_FIELDS`)으로 정한다: 제목, 저자, 역자, 출판사, 출판 연도, ISBN,
  표지, 상태, 읽은 기간, 형식, 경로, 별점, 태그, `oneLiner`, `relatedPost`. 워크벤치 책 문서에 새 필드가
  생겨도 기본값이 비공개다.
- `excerpts`, `memos`, 문서 본문은 허용 목록 밖이므로 책 항목으로는 나가지 않는다.
- `visible: false` 인 책은 블로그에서 숨기는 대신 **파일로 내보내지 않는다**. 공개 저장소의 Git 이력에
  남지 않게 하기 위해서다.
- `want` 상태의 공개 여부는 현재 블로그 동작을 따른다.
- 내보내기는 글 발행과 같은 게이트(메타데이터 확인 → 공개 범위 검사 → 결정적 변환 → diff 미리보기 →
  명시적 확정)를 거친다. 자동 동기화는 없다.
- 변환은 워크벤치 core 의 순수 함수 `toPublicBook(record, coverInfo)` 가 한다. 표지 너비·높이는 어댑터가
  이미지 헤더에서 읽어 넘기고, 표지 파일은 `bookCoversDir` 로 복사한다. NOR-188 이 남긴 "변환을 어디서
  할지"는 **워크벤치 내보내기 시점**으로 정한다.
- 블로그에 손으로 관리하던 `books/*.json` 은 워크벤치로 한 번 가져온 뒤 워크벤치를 원본으로 삼는다.

### 글 안의 구절 인용 (`bookquote`)

NOR-189 가 막은 것은 구절의 **자동** 공개다. 사람이 판단한 인용은 다음 장치를 두고 연다.

- **구절별 opt-in.** 구절마다 `public: true` 를 명시해야 한다. 키가 없으면 비공개다. 책 단위 일괄 스위치는
  두지 않는다.
- **안정 id.** 구절은 지금 배열 순번으로만 식별된다. 불렛과 같은 방식으로 ULID `id` 를 부여하고, 기존
  구절은 처음 저장할 때 채운다.
- **노출 지점은 글 본문뿐.** `public: true` 만으로는 어디에도 나가지 않는다. 글에서
  `{% bookquote book="<책 id>" excerpt="<구절 id>" /%}` 로 인용할 때만 나간다. 책장에 구절을 따로 두지 않는다.
- **발행 게이트.** 참조한 구절이 없거나 `public: true` 가 아니면 발행을 거부한다.
- **결정적 변환.** 발행 시 태그를 `{% bookquote cite="…" page=42 %}구절 원문{% /bookquote %}` 로 펼친다.
  공개 저장소에는 그 글이 실제로 인용한 구절만 들어가고, 블로그가 워크벤치 책 데이터를 참조하는 길은 없다.
- **출처 자동 표기.** 저자·제목·역자·출판사·쪽수는 책 문서에서 채운다. 빠뜨릴 수 없다.
- **분량 경고.** 미리보기에서 인용 길이와 같은 책의 공개 구절 누적 분량을 보여 주고, 기준을 넘으면 경고한다.
  판단은 사람이 한다. 저작권법 제28조(정당한 범위·공정한 관행)·제37조(출처 명시) 판단을 돕는 장치일 뿐
  법적 검토를 대신하지 않는다.
- **블로그 렌더링.** `bookquote` Markdoc 태그를 `<figure><blockquote cite>` + `<figcaption>`(저자·제목·역자·쪽수)
  으로 렌더링한다. 책장에 있는 책이면 출처를 책장 항목에 연결한다. 태그 속성 스키마는 `bookquoteTag` 하나를
  양쪽이 쓴다.

### 계약 테스트

| 위치                    | 검사                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content-contract` 단위 | slug 규칙, series·seriesOrder 동반 규칙, `toc` 허용값, `bookquoteTag` 속성                                                                            |
| 실제 글 전수            | `apps/blog/src/content/posts` 의 모든 글이 워크벤치 strict 검증을 통과한다                                                                            |
| 실제 책 전수            | `apps/blog/src/content/books` 의 모든 책이 `bookSchema` 를 통과한다                                                                                   |
| 글 왕복                 | 워크벤치 변환 출력을 블로그 스키마로 다시 파싱하면 같은 값이 나온다                                                                                   |
| 책 공개 범위            | `excerpts`·`memos` 를 채운 입력의 `toPublicBook` 출력에 허용 목록 밖 키가 없다. `visible: false` 는 내보내기 대상에서 빠진다                          |
| 인용                    | 비공개 구절 인용은 거부된다. 펼친 결과가 블로그 Markdoc 검증을 통과한다. 출처가 빠지지 않는다. 구절 순서를 바꾸거나 다른 구절을 지워도 id 가 유지된다 |

첫 red 테스트는 (a) Astro `defineCollection` 이 외부 패키지의 스키마를 받는지, (b) `toc: floating` 이 있는
초안의 발행이 현재 거부되는 버그 재현이다.

## 3. 툴체인

### 런타임·패키지 매니저

- **Node 26 (Active LTS)** 로 통일한다. 현재 블로그 `>=22.12`, 워크벤치 이미지 `node:22`.
- 루트 `mise.toml` 이 Node·pnpm 버전의 단일 출처다. CI 와 Dockerfile 은 이 값을 따른다. `packageManager`
  필드로 pnpm 을 고정한다.
- 공용 의존성(zod, react, typescript, vitest, tailwindcss 등)은 pnpm catalog 로 버전을 한 곳에서 관리한다.

### TypeScript

- TypeScript 6 으로 통일하고 `packages/config/tsconfig.base.json` 을 베이스로 둔다.
- 엄격도는 워크벤치 기준: `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
- 블로그는 전환 단계에서만 두 옵션을 끄고, 끈 이유와 제거할 일감을 주석으로 남긴다. 실제 수정은 하위 프로젝트 2.
- 블로그 `astro check`, 워크벤치 `tsc -b` 를 루트 `pnpm typecheck` 로 묶는다.

### ESLint·Prettier

- `packages/config` 가 공통 flat config(`@eslint/js` recommended, `typescript-eslint` strict,
  `eslint-config-prettier`)를 내보낸다.
- 블로그는 `eslint-plugin-astro` + jsx-a11y, 워크벤치는 react-hooks + react-refresh 를 덧붙인다.
- §1 의존 방향 규칙을 `no-restricted-imports` 로 강제한다.
- Prettier 는 루트 설정 하나. Astro 플러그인은 `*.astro` override 로만 적용한다.

### 테스트

- 루트 `vitest.config.ts` 의 `test.projects` 로 `apps/*`, `packages/*` 를 묶는다.
- e2e 는 Playwright 하나. 워크벤치 e2e 는 유지하고, 블로그는 `astro preview` 로 산출물을 띄워 검사하는 e2e 를
  새로 둔다. `scripts/verify-*.mjs` 의 이전·정리는 하위 프로젝트 2.
- 커버리지는 v8 provider. 처음에는 리포트만 남기고, 기준선을 잰 뒤 하한을 정한다.

### 루트 스크립트

```text
pnpm dev:blog / pnpm dev:workbench
pnpm typecheck · pnpm lint · pnpm format:check · pnpm test · pnpm build · pnpm e2e
pnpm verify   # 위 단계를 CI 와 같은 순서로 실행하는 커밋 전 로컬 게이트
pnpm spec:check
```

## 4. SDD/TDD 흐름과 CI 게이트

### 명세

- spec 은 `docs/spec/<blog|workbench|contract>/NOR-N-제목.md`. 수용 기준은 `AC-1`, `AC-2` … 로 번호를 붙인다.
- 테스트 이름에 id 를 넣는다: `it('NOR-201 AC-3: 비공개 구절을 인용하면 발행을 거부한다')`.
- `pnpm spec:check` 는 spec 의 모든 AC 가 테스트 하나 이상과 연결됐는지 검사하고, 아니면 실패한다.
  자동화할 수 없는 AC 는 spec 에 `manual` 로 표시해 예외로 둔다.

### 커밋

기존 규약(gitmoji + Conventional + Linear ID)에 trailer 를 더한다.

```text
✅ test(contract): toc 가 있는 초안의 발행을 재현한다 (NOR-201)

TDD: red
Spec: NOR-201 AC-2
```

- 순서: spec 커밋 → `TDD: red` → `TDD: green` → (필요 시) `TDD: refactor`.
- 처음부터 통과하는 테스트는 `TDD: regression` 으로 표시해 TDD 와 구분한다.
- 이 설계 이전의 커밋은 다시 쓰지 않는다.

### CI 의 red→green 검증 (`tdd-evidence`)

- PR 마다 `TDD: red` 커밋을 체크아웃해 그 커밋이 바꾼 테스트 파일만 실행하고 **실패**를 확인한다. 이어지는
  green 커밋에서 같은 테스트의 **통과**를 확인한다.
- Vitest JSON 리포트로 실패 원인을 구분한다. 문법·설정 오류는 가짜 red 로 거부하고, 아직 없는 모듈을 import 해
  생긴 실패는 정상 red 로 인정한다.
- red 커밋은 브랜치 안에서만 실패한다. PR HEAD 는 언제나 green 이어야 한다.

### GitHub Actions

| workflow / job                          | 언제                                    | 하는 일                                                                                                |
| --------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `ci.yml` › `verify`                     | PR, `v4`·`master` push                  | 변경 영향 범위에 `pnpm verify`. 계약 테스트는 항상                                                     |
| `ci.yml` › `e2e`                        | PR                                      | 블로그·워크벤치 Playwright                                                                             |
| `ci.yml` › `spec-check`, `tdd-evidence` | PR                                      | 위 명세·커밋 검사                                                                                      |
| `workbench-image.yml`                   | `master` push(워크벤치 경로 변경), 태그 | `ubuntu-24.04-arm` 러너에서 linux/arm64 이미지를 네이티브 빌드해 GHCR 에 게시, digest 를 요약에 남긴다 |

- `v4`·`master` 에 GitHub ruleset 으로 필수 check 를 건다. 저장소 설정 변경이므로 적용 전에 확인을 받는다.

### 에이전트 규약

- `AGENTS.md`, `docs/conventions/workflow.md`, `docs/conventions/coding.md` 를 이 흐름으로 갱신하고 "스캐폴딩 후
  확정" 같은 자리표시 문구를 정리한다.
- 전체 작업 마무리 직전에 Claude·Codex 병렬 보안 검수를 한 번 돌리는 절차를 규약에 넣는다.

## 5. 이관 절차와 공개 전 검수

1. **블로그 이동.** `v4` 에서 작업 브랜치를 만들고 `git mv` 로 `apps/blog` 에 옮긴다. 이동만 담은 커밋을 따로
   두어 rename 감지로 이력을 잇는다. 이동 전후 `dist/` 를 바이트 단위로 비교해 산출물 불변을 증명하고, 테스트
   388건 통과를 확인한다.
2. **워크벤치 스냅샷.** `personal-workbench` 커밋 `8453402` 에서 `git archive` 로 꺼내 `apps/workbench/` 에 푼다.
   `docs/_temp/`, `dist/`, `test-results/`, `.env*` 는 제외하고, `.env.example` 은 검수 후 포함한다. 커밋 본문에
   원본 저장소와 해시를 남긴다. 테스트 232건·typecheck·lint·e2e 통과를 확인한다.
3. **공개 전 검수.** 커밋 전에 모두 통과해야 한다.
   - `gitleaks` 로 가져올 트리 전체를 스캔한다.
   - Tailnet 도메인(`*.ts.net`), Tailscale IP 대역(`100.64.0.0/10`), 호스트명, 개인 이메일, 로컬 절대 경로를 검색한다.
   - 운영 문서(`docs/operations/*`)는 사람이 읽고, 호스트 구성·계정명처럼 공격 표면을 알려 주는 정보는 일반화한다.
   - 검수 결과를 PR 본문 체크리스트로 남긴다.
4. **계약 추출.** §2 를 §4 흐름으로 구현한다. 첫 red 테스트는 §2 끝에 적은 두 개다.
5. **외부 조치.** 아래는 실행 직전에 하나씩 확인을 받는다.
   - 공개 저장소에 이관 브랜치 push
   - `personal-workbench` 저장소 archive 전환
   - GHCR 패키지 `personal-workbench` 의 Actions 접근 권한을 새 저장소에 부여
   - GitHub ruleset 적용
   - Linear 하위 프로젝트별 일감 생성

## 완료 조건

1a:

- `apps/blog`, `apps/workbench`, `packages/content-contract`, `packages/config` 구조로 `pnpm verify` 가 통과한다.
- 블로그 산출물이 이동 전과 바이트 단위로 같다(계약 추출 이전 시점 기준).
- 블로그와 워크벤치가 `content-contract` 하나에서 `postSchema` 를 가져온다.
- `toc` 가 있는 글을 워크벤치가 발행·가져오기할 수 있다.
- §2 계약 테스트 표 중 글 관련 항목(단위·글 전수·글 왕복)이 테스트로 존재한다.
- `ci.yml` 이 PR 에서 `verify`·`e2e`·`spec-check`·`tdd-evidence` 를 실행하고, `workbench-image.yml` 이 arm64 이미지를 게시한다.
- 공개 전 검수 체크리스트가 PR 에 남아 있다.

1b:

- 블로그와 워크벤치가 `bookSchema`·`bookquoteTag` 를 `content-contract` 에서 가져온다.
- 워크벤치에서 책 목록을 발행 게이트를 거쳐 블로그로 내보낼 수 있고, 기존 `books/*.json` 을 가져왔다.
- 글에서 공개 구절을 `bookquote` 로 인용할 수 있다.
- §2 계약 테스트 표의 나머지 항목(책 전수·책 공개 범위·인용)이 테스트로 존재한다.

## 범위 밖

- 블로그 `src/lib` 계층 정리, 엄격 TS 옵션으로 인한 블로그 오류 수정, draft 노출 수정, Mermaid 청크 → 하위 프로젝트 2
- OCI 호스트 구성, WORKSPACE_ROOT 저장소 생성 → 하위 프로젝트 3
- 블로그 호스팅 선택, `publishBranch` 확정, 도메인 → 하위 프로젝트 4
- 댓글 서버 선택과 배포 → 하위 프로젝트 5

## 관련 문서

- 워크벤치 원 설계: [2026-08-12-private-workbench-design.md](./2026-08-12-private-workbench-design.md)
- 작성 경계: [ADR 0016](../../decisions/0016-private-workbench-authoring.md)
- 작업 흐름: [conventions/workflow.md](../../conventions/workflow.md)
- 책장: [NOR-188](../../spec/NOR-188-bookshelf.md)
