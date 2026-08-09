---
issue: NOR-19
title: Keystatic 설치·구성 (Content Collections 매핑)
status: done
---

# NOR-19 — Keystatic 설치·구성 (Content Collections 매핑)

> Linear: https://linear.app/noru-kim/issue/NOR-19

## 목표

`pnpm dev` 에서 `/keystatic` 어드민으로 글·시리즈·포트폴리오를 만들고 고칠 수 있다. 그렇게 만든
파일은 `src/content/schemas.ts` 의 zod 를 통과하고, **프로덕션 빌드 산출물은 도입 전과 똑같이
완전한 정적 사이트**로 남는다.

## 입력 / 출력

- 입력: 어드민 폼 입력 → 로컬 모드 API(`/api/keystatic/...`) → 작업 트리의 파일.
- 출력:
  - 글 — `src/content/posts/<slug>.mdoc` (YAML 프론트매터 + Markdoc 본문)
  - 시리즈 — `src/content/series/<slug>.json`
  - 포트폴리오 — `src/content/portfolio/<id>.json`

## 동작 / 상태 전이

```
pnpm dev ──▶ keystaticDev() 가 command==='dev' 를 보고 react()+keystatic() 등록
              └▶ /keystatic (어드민 UI) · /api/keystatic/[...] (로컬 파일 IO)
                   └▶ 저장 ──▶ 작업 트리에 파일 쓰기 ──▶ Astro content layer 가 다시 읽음(HMR)

pnpm build ─▶ keystaticDev() 가 아무것도 하지 않음
              └▶ 통합·라우트·React 런타임 없음 ──▶ 지금까지와 동일한 정적 dist
```

## zod ↔ Keystatic 대응표

`src/content/schemas.ts` 가 진실의 원천이고, `keystatic.config.ts` 가 그것을 폼으로 옮긴 것이다.

### posts (`src/content/posts/*.mdoc`)

| zod                                     | Keystatic 필드                                     | 비고                                                      |
| --------------------------------------- | -------------------------------------------------- | --------------------------------------------------------- |
| `title: string`                         | `fields.text({ isRequired })`                      |                                                           |
| `description: string`                   | `fields.text({ multiline, isRequired })`           |                                                           |
| `slug: string.regex(SLUG_PATTERN)`      | `fields.slug` (`slugField`)                        | name=슬러그 자체, `generate: (n) => n` → 파일명과 같은 값 |
| `category: string`                      | `fields.text({ isRequired })`                      |                                                           |
| `tags: string[].min(1)`                 | `fields.array(text, { length: { min: 1 } })`       | 폼에서 강제됨                                             |
| `series?: string`                       | `fields.relationship({ collection: 'series' })`    | 비우면 키 자체가 안 써짐                                  |
| `seriesOrder?: number.int().positive()` | `fields.integer({ min: 1 })`                       | 비우면 키 자체가 안 써짐                                  |
| `publishedAt: coerce.date()`            | `fields.date({ defaultValue: today, isRequired })` | `2026-07-22` 형식으로 직렬화 — 기존 글과 동일             |
| `updatedAt: coerce.date()`              | `fields.date({ defaultValue: today, isRequired })` |                                                           |
| `draft: boolean.default(false)`         | `fields.checkbox({ defaultValue: false })`         | 항상 기록된다(`draft: false`)                             |
| —                                       | `content: fields.markdoc({ extension: 'mdoc' })`   | 본문. 프론트매터에 쓰이지 않으므로 zod 대응 없음          |

### series (`src/content/series/*.json`)

| zod                  | Keystatic 필드                | 비고                      |
| -------------------- | ----------------------------- | ------------------------- |
| `name: string`       | `fields.text({ isRequired })` |                           |
| `slug: string.regex` | `fields.slug` (`slugField`)   | 파일명 = slug = 엔트리 id |
| `description`        | `fields.text({ multiline })`  |                           |

### portfolio (`src/content/portfolio/*.json`)

| zod                      | Keystatic 필드                                       | 비고                              |
| ------------------------ | ---------------------------------------------------- | --------------------------------- |
| (zod 밖)                 | `id: fields.slug` (`slugField`)                      | 파일명 = 엔트리 id. zod 는 무시   |
| `title`, `summary`       | `fields.text`                                        |                                   |
| `stack: string[].min(1)` | `fields.array(text, { length: { min: 1 } })`         | 폼에서 강제됨                     |
| `links: [...].min(1)`    | `fields.array(object{repo,demo,video,article: url})` | 개수는 강제, **항목 내용은 아님** |
| `thumbnail?: string`     | `fields.text`                                        | 빈 문자열이면 키가 안 써짐        |

## 성공 / 실패 조건

- 성공
  - `pnpm dev` 에서 `/keystatic` 이 뜨고 세 컬렉션이 모두 목록에 나온다.
  - 어드민으로 만든 글이 zod 를 통과하고 `pnpm build` 산출물에 페이지로 들어간다.
  - `pnpm build` 산출물에 `keystatic` 라우트도 React 런타임도 없다.
- 실패·예외
  - `@keystar/ui`·`react-aria`·`react-stately` 가 없으면 어드민이 하얗게 뜨고 콘솔에
    `Could not resolve "@keystar/ui/layout"` 이 찍힌다 (ADR 0012 참고).
  - 필드 간 제약 위반(아래)은 저장은 되고 **다음 빌드에서** zod 가 잡는다.

## 엣지 케이스 · 알려진 한계

1. **series ↔ seriesOrder 동반 필수를 폼에서 막을 수 없다.**
   Keystatic 에는 필드 간(cross-field) 검증이 없다. `fields.conditional` 은 값을
   `{ discriminant, value }` 로 **중첩 저장**하므로 평평한 `series`/`seriesOrder` 두 키를 만들 수
   없다. 완화책: `series` 를 `relationship` 으로 두어 존재하는 시리즈만 고르게 하고, 두 필드의
   설명에 동반 필수를 적어 둔다. 어긋나면 zod refine 과 `assertSeriesIntegrity` 가 빌드를 세운다.
2. **portfolio 링크 항목의 "URL 최소 1개"도 같은 이유로 폼에서 막을 수 없다.** 링크 *개수*는
   `validation.length.min` 으로 강제된다. 빈 링크는 zod refine 이 빌드에서 잡는다.
3. **Markdown 렌더 스모크·픽스처는 어드민 목록에 뜨지 않는다.** Keystatic 컬렉션은 확장자 하나만
   소유한다(ADR 0012). 실제 공개 글은 NOR-20에서 `.mdoc`으로 이관했고, 렌더 비교용 `.md`만 남긴다.
4. **커스텀 블럭(`{% bookmark %}` 등)이 든 `.mdoc`** 은 에디터가 태그를 모른다. 태그 등록은
   NOR-20 범위다.
5. **파일명 ≠ 슬러그인 기존 글**(ADR 0009 의 의도된 사례)은 그대로 둔다. 어드민이 새로 만드는 글은
   파일명과 슬러그가 항상 같다.
6. 어드민이 쓴 JSON 은 prettier 포맷과 일치한다(확인함). `.mdoc` 은 prettier 대상이 아니다.

## 검증 방법

- [x] `pnpm lint` / `pnpm format:check` / `pnpm test` / `pnpm build` 통과
- [x] 코드 변경만 한 상태의 `dist` 가 v4 기준과 **완전히 동일** — 49 페이지, HTML 목록 diff 없음,
      `_astro/*.js` 목록 diff 없음
- [x] `dist/keystatic`·`dist/api` 디렉토리가 없다
- [x] `dist/_astro/*.js` 중 React 런타임 없음
- [x] `pnpm dev` 에서 `/keystatic` 200, `/api/keystatic/tree` 200 (`no-cors: 1` 헤더)
- [x] 어드민 UI 로 글 생성 → `src/content/posts/keystatic-roundtrip.mdoc` 생성 → zod 통과 →
      `pnpm build` 에 `/blog/keystatic-roundtrip` 포함 → 페이지 본문 렌더 확인
- [x] 어드민 UI 로 같은 글 수정(설명 변경) → 파일 반영 확인
- [x] 어드민에서 posts 7건(.mdoc)·series 2건·portfolio 1건이 목록에 뜨고, 항목을 열면 기존 값이
      그대로 채워진다
- [x] 시리즈/포트폴리오 데이터 이관 후에도 `/series`, `/series/astro-guide`, 시리즈 내비게이션이
      그대로 동작 (dist diff 없음으로 확인)

## 구현 계획 (plan)

1. 의존성 설치 — `@keystatic/core`·`@keystatic/astro`·`@astrojs/react`·`react`·`react-dom` +
   pnpm 이 건너뛰는 피어 3종. 전부 `devDependencies`.
2. 슬러그 정규식을 `src/content/slug-pattern.ts` 로 분리해 zod 와 Keystatic 이 공유.
3. `keystatic.config.ts` — 세 컬렉션을 zod 와 1:1 로 매핑.
4. `src/integrations/keystatic-dev.ts` — dev 에서만 통합 등록. `astro.config.mjs` 에 연결.
5. series·portfolio 를 엔트리별 파일로 이관하고 `content.config.ts` 의 로더를 `glob()` 으로 교체.
6. 검증 — dist 비교, dev 어드민 왕복.

## 완료 조건 (일감)

- [x] Keystatic 설치 + Astro 통합
- [x] posts/series/portfolio 컬렉션 스키마를 Keystatic config 에 매핑
- [x] 로컬 모드에서 글 생성/수정 동작
