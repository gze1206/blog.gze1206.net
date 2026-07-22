---
issue: NOR-16
title: 블로그 목록/상세 + 카테고리·태그·시리즈 페이지
status: done
---

# NOR-16 — 블로그 목록/상세 + 카테고리·태그·시리즈 페이지

> Linear: https://linear.app/noru-kim/issue/NOR-16
> 설계 근거: [ADR 0009 — 블로그 라우팅·슬러그·draft 처리 전략](../decisions/0009-blog-routing-slug-draft-strategy.md)

## 목표

실제 블로그 라우트를 만든다. 글 목록(페이지네이션)·상세·카테고리/태그/시리즈 페이지가 생기고,
`draft: true` 글은 프로덕션 산출물에 **페이지 자체가 존재하지 않는다**.

## 입력 / 출력

- 입력
  - `posts` 컬렉션 (`src/content/posts/**/*.{md,mdoc}`) — `postSchema` 통과분.
  - `series` 컬렉션 (`src/content/series/index.json`) — `id`/`name`/`slug`/`description`.
  - 환경: `import.meta.env.DEV` (dev 서버 여부).
- 출력 (정적 HTML)

  | 경로               | 내용                                 | 생성 조건                      |
  | ------------------ | ------------------------------------ | ------------------------------ |
  | `/blog`            | 목록 1페이지                         | 항상                           |
  | `/blog/{n}`        | 목록 n페이지 (n ≥ 2)                 | 글이 `10 × (n-1)` 개 초과일 때 |
  | `/blog/{slug}`     | 글 상세                              | 노출 대상 글마다               |
  | `/category`        | 카테고리 인덱스                      | 항상                           |
  | `/category/{slug}` | 카테고리별 목록                      | 그 카테고리에 글이 1개 이상    |
  | `/tags`            | 태그 인덱스                          | 항상                           |
  | `/tags/{slug}`     | 태그별 목록                          | 그 태그에 글이 1개 이상        |
  | `/series`          | 시리즈 인덱스                        | 항상                           |
  | `/series/{slug}`   | 시리즈별 목록 (seriesOrder 오름차순) | 그 시리즈에 글이 1개 이상      |

## 동작 / 상태 전이

```
getCollection('posts') ─┐
import.meta.glob(?raw) ─┤
getCollection('series')─┘
        │
        ▼  src/lib/content.ts — loadVisiblePosts()   ※ 빌드 1회당 1번, 결과 캐시
   [무결성 검사]  전수(draft 포함) 대상
     1. assertUniqueSourceSlugs   원본 파일 기준 slug 중복 → 실패
     2. assertUniquePostSlugs     컬렉션 기준 중복 (로더 변경 대비 백스톱)
     3. assertPaginationSafeSlugs 숫자만인 slug → 실패
     4. assertSeriesIntegrity     미존재 시리즈 참조 / seriesOrder 중복 → 실패
     5. groupByCategory/ByTag     분류 슬러그 충돌 → 실패
        │
        ▼
   selectVisible(posts, import.meta.env.DEV)   ← draft 필터의 유일한 지점
        │
        ▼
   sortByPublishedDesc            publishedAt 내림차순, 동일 날짜는 slug 오름차순
        │
        ├─→ paginate(pageSize: 10)  → /blog, /blog/2 …
        ├─→ getStaticPaths           → /blog/{slug}
        ├─→ groupByCategory/ByTag    → /category/{slug}, /tags/{slug}
        └─→ getSeriesWithPosts       → /series/{slug}
```

라우트는 `getCollection` 을 직접 부르지 않는다. 전부 `src/lib/content.ts` 를 경유한다.

## 성공 / 실패 조건

- 성공
  - `pnpm lint` · `format:check` · `test` · `build` 전부 통과.
  - `dist/` 에 draft 글의 상세 페이지가 **없다**.
  - `/blog` 가 페이지네이션되고 `/blog/1` 은 존재하지 않는다.
  - 카테고리/태그/시리즈 하위 페이지에 **해당 글만** 들어간다.
- 실패(빌드 중단) — 아래는 모두 `ContentIntegrityError` 로 빌드를 세운다.
  - 서로 다른 파일이 같은 프론트매터 `slug` 를 쓸 때.
  - slug 가 숫자만으로 이루어져 페이지네이션 경로와 충돌할 때.
  - `posts.series` 가 `series` 컬렉션에 없는 id 를 가리킬 때.
  - 같은 시리즈 안에서 `seriesOrder` 가 겹칠 때.
  - 표시 문자열이 다른 카테고리/태그가 같은 슬러그로 떨어질 때.
  - 프론트매터에서 `slug:` 줄을 읽을 수 없을 때.

## 엣지 케이스

| 케이스                           | 동작                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| 노출 대상 글 0개                 | `/blog` 는 생성되고 빈 상태 문구를 보여준다(`paginate` 가 빈 1페이지 생성)              |
| 글이 0개인 시리즈                | `/series/{slug}` 를 만들지 않고 `/series` 인덱스에서도 뺀다                             |
| 존재하지 않는 slug/분류 접근     | 페이지가 없으므로 404 (커스텀 404 는 NOR-26)                                            |
| 한글 카테고리/태그               | 한글 슬러그로 파생, `href` 는 퍼센트 인코딩 (`웹 성능` → `웹-성능`)                     |
| `C#` / `C++` 태그                | `c-sharp` / `c-plus-plus` 로 음차 — 기호를 버려 `C` 와 충돌하는 것을 막는다             |
| 파일명 ≠ slug                    | URL 은 slug 를 따른다 (`fixture-typescript-strict.md` → `/blog/typescript-strict-tips`) |
| 같은 날 발행된 글 여럿           | slug 오름차순으로 고정 — 빌드 결과가 결정적이어야 한다                                  |
| `publishedAt` 이 UTC 자정        | 표시·`datetime` 모두 UTC 기준으로 포매팅 (로컬 타임존에서 하루 밀림 방지)               |
| 같은 글이 같은 태그를 두 번 기재 | 한 번만 센다                                                                            |

## 검증 방법 (= TDD 테스트 목록)

단위 테스트 (`src/lib/*.test.ts` — 이 일감에서 추가한 4개 파일 포함, 전체 스위트 111개 통과):

- [x] `toSlug` — 영문 kebab, 한글 보존, `#`/`+` 음차, 결정성, NFKC, 빈 슬러그 예외
- [x] `selectVisible` — draft 제외 / dev 포함 / 입력 불변
- [x] `sortByPublishedDesc` — 내림차순 + 동일 날짜 tie-break
- [x] `assertUniqueSourceSlugs` — 파일 기준 중복 검출, 본문의 `slug:` 에 속지 않음, 파싱 실패 시 예외
- [x] `assertUniquePostSlugs` — 컬렉션 기준 중복(draft 포함)
- [x] `assertPaginationSafeSlugs` — 숫자만인 slug 거부, 숫자 포함은 허용
- [x] `groupByCategory` / `groupByTag` — 원문 라벨 보존, 다중 태그, 중복 기재, **슬러그 충돌 예외**
- [x] `assertSeriesIntegrity` — 미존재 참조 / `seriesOrder` 중복 / draft 도 검사
- [x] `selectSeriesPosts` — `seriesOrder` 오름차순, 없는 시리즈는 빈 배열
- [x] `blogPagePath` — 1페이지는 `/blog`, 2페이지부터 `/blog/2`
- [x] `formatKoreanDate`/`toISODate` — UTC 고정

빌드 산출물 검증 (`pnpm build` 후 `dist/`):

- [x] draft 9편의 `/blog/{slug}` 디렉터리가 **하나도 없음**
- [x] draft slug 로 가는 `href` 가 `dist/` 어디에도 없음 (smoke 전용 페이지 제외)
- [x] `/blog` 10개 카드, `/blog/2` 2개 카드, `/blog/1` 없음
- [x] `/category/dev` 7편 · `/category/웹-성능` 3편 · `/tags/c-sharp` 1편 — 해당 글만
- [x] `/series/astro-guide` 3편이 **seriesOrder 순서**(발행일 순서와 다르게 배치해 검증)

빌드 실패 검증 (임시 프로브 파일로 재현 후 제거):

- [x] slug 중복 → `[NOR-16] slug 중복: …` 로 빌드 실패
- [x] 숫자 slug → 빌드 실패
- [x] 미존재 시리즈 참조 → 빌드 실패
- [x] `TypeScript` vs `typescript` 태그 → 빌드 실패

dev 서버 검증:

- [x] `/blog/draft-example` 이 dev 에서 200 (초안 확인 가능), 프로덕션 빌드에는 없음
- [x] 목록에 "초안" 배지 노출, dev 는 21편/3페이지 · build 는 12편/2페이지

## 구현 계획 (plan)

1. `src/lib/slug.ts` — 표시 문자열 → 슬러그 (+ 테스트)
2. `src/lib/posts.ts` — draft 필터·정렬·분류 묶기·무결성 검사 (순수, + 테스트)
3. `src/lib/routes.ts`, `src/lib/date.ts` — URL·날짜 조립 (+ 테스트)
4. `src/lib/content.ts` — `astro:content` 와 위 순수 로직을 잇는 **유일한 통로**
5. 컴포넌트 — `PostCard`, `Pagination`, `TaxonomyIndex`, `EmptyState`, `SiteHeader`, `SiteFooter`
6. 레이아웃 — `ListLayout`(목록 공통), `PostLayout`(상세, NOR-17/18 확장 슬롯 포함)
7. 라우트 8개 + 루트 페이지에 최근 글
8. 픽스처 글 추가 — 페이지네이션 2페이지, 시리즈 3편, 한글 분류를 실제로 검증하기 위해
9. `astro.config.mjs` 에 `site` 설정
10. ADR 0009 · 이 spec 작성

## 접근성 메모

- 카드는 **제목만 링크**다. 카드 전체를 링크로 감싸면 스크린리더의 링크 목록에 설명 전체가 읽힌다.
  "더 보기" 같은 맥락 없는 링크 텍스트는 쓰지 않는다.
- 페이지네이션은 `<nav aria-label>` + 현재 페이지 `aria-current="page"`. 현재 페이지는 링크가 아니라
  `<span>` 이고, 숫자만 있는 링크에는 `sr-only` 로 "페이지"/"현재 페이지" 를 붙인다.
- 헤딩: 페이지 `h1` 1개 → 카드 제목 `h2` (루트 페이지의 "최근 글" 아래는 `h3`).
- 랜드마크: `header`/`nav`/`main`/`footer`. skip-link 는 NOR-26.
- 키보드 포커스는 전역 `:focus-visible` outline 으로 보장. 다크모드는 `prefers-color-scheme` 대응.
- 모바일 우선 — 컨테이너 `max-w-3xl` + `px-4`, 태그/페이지네이션은 `flex-wrap`.

## 픽스처 글 (임시)

검증을 위해 발행 상태 픽스처 11편을 넣었다. 이게 없으면 페이지네이션도 시리즈도 "구현했다"는 말밖에
남지 않는다. **NOR-35(콘텐츠 작성)에서 실제 글로 교체하거나 제거한다.**

- 시리즈 `astro-guide` 3편 — `astro-content-collections` / `astro-markdoc-workflow` / `astro-deploy-cloudflare`
  (발행일 순서와 `seriesOrder` 를 일부러 어긋나게 뒀다)
- 카테고리 `dev` 6편(시리즈 3편 포함), `웹 성능` 3편, `회고` 2편
- `fixture-typescript-strict.md` — 파일명과 slug 가 다른 사례

## 완료 조건 (일감)

- [x] `/blog` 목록(페이지네이션)
- [x] `/blog/[slug]` 상세(영문 슬러그)
- [x] `/category/[..]`, `/tags/[..]`, `/series/[..]` 페이지
- [x] draft 제외 로직

## 알려진 한계

- 페이지네이션은 모든 페이지 번호를 나열한다. 글이 수백 편이 돼 페이지가 수십 개가 되면 말줄임
  윈도우가 필요하다. 지금은 2페이지라 넣어도 검증할 수 없어서 미룬다.
- 카테고리/태그/시리즈 하위 페이지는 페이지네이션이 없다(ADR 0009 §4).

## 범위 밖

- TOC·앵커·읽기시간·작성/수정일 강화 → NOR-17 (`PostLayout` 의 `after-content` 슬롯이 자리)
- 시리즈 이전/다음 편 내비게이션·진행도 → NOR-18
- 사이트맵·RSS·JSON-LD·OG 이미지·canonical → NOR-27~30 (`site` 설정만 미리 넣음)
- 커스텀 404 → NOR-26
- 테마·타이포그래피 확정 → NOR-24 (지금은 읽을 수 있는 최소치만)
