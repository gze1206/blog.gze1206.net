---
issue: NOR-27
title: 메타 위생 — title/description/canonical/robots/OG
status: done # draft | in-progress | done
---

# NOR-27 — 메타 위생: title/description/canonical/robots/OG

> Linear: https://linear.app/noru-kim/issue/NOR-27

## 목표

빌드가 만드는 **모든 페이지**가 `title` · `description` · `canonical` 을 정확히 하나씩 갖고,
OG/Twitter 카드 메타를 공통 컴포넌트 한 곳에서 만든다. 검증용 `/smoke/*` 는 색인에서 제외한다.

## 입력 / 출력

- 입력
  - 페이지가 넘기는 **맨 제목**(사이트 이름 접미사 없음) · 설명 · OG 타입 · 글이면 발행/수정 ISO 시각.
  - 현재 경로(`Astro.url.pathname`) 와 배포 도메인(`Astro.site` = `https://gze1206.net`).
- 출력
  - `<head>` 안의 메타 묶음 1세트: `<title>` · `meta[name=description]` · `link[rel=canonical]` ·
    `meta[name=robots]` · `og:*` · `twitter:*` · (글 한정) `article:published_time` / `article:modified_time`.

## 동작 / 상태 전이

메타 조립은 **순수 함수 하나**(`buildSeoMeta`)가 전부 담당하고, `.astro` 는 결과를 태그로 펴기만 한다.

```
페이지 props ─┐
              ├─> buildSeoMeta(input, { pathname, site }) ─> SeoMeta ─> <SeoMeta /> ─> <head>
경로 · site ──┘
```

| 계층                           | 책임                                                                       |
| ------------------------------ | -------------------------------------------------------------------------- |
| `src/lib/site-meta.ts`         | 제목 조합 · 경로 정규화 · 절대 URL · 색인 여부 판정 (**단위 테스트 대상**) |
| `src/components/SeoMeta.astro` | `SeoMeta` 객체를 `<meta>` 로 렌더 (**유일한** 메타 출력 지점)              |
| `src/layouts/BaseLayout.astro` | `<head>` 에서 `SeoMeta` 를 **한 번만** 호출                                |
| `ListLayout` / `PostLayout`    | 상위 레이아웃으로 값을 넘기기만 한다. 자체 메타 출력 없음.                 |

메타를 만드는 곳이 `BaseLayout` 하나뿐이므로, 레이아웃이 중첩돼도 개수가 2가 되거나 0이 될 수 없다.

## 결정

### 1. trailing slash — **없음**(루트 `/` 만 예외)

→ [ADR 0013](../decisions/0013-canonical-url-trailing-slash-policy.md)

canonical 은 `absoluteUrl()` 이 경로 끝 슬래시를 떼고 만든다. 사이트 내부 링크를 만드는
`src/lib/routes.ts` 가 이미 슬래시 없는 경로(`/blog`, `/blog/2`, `/category/dev`)를 내보내므로
canonical 과 실제 링크·생성 경로가 한 벌로 맞는다. `astro.config.mjs` 의 `trailingSlash: 'never'`
가 dev 서버까지 같은 규칙을 강제한다.

### 2. 페이지네이션 canonical — **자기 자신**

`/blog/2` 의 canonical 은 `https://gze1206.net/blog/2` 다. `/blog` 로 접어버리면 2페이지 이후 글이
색인에서 통째로 빠진다. `canonical = absoluteUrl(현재 경로)` 라는 한 줄 규칙이라 예외를 만들 여지가 없다.
`/blog` 와 `/blog/1` 이 동시에 존재하지 않는 것은 NOR-16 의 `blogPagePath` 가 이미 보장한다.

### 3. `/smoke/*` 색인 차단 — **noindex + robots.txt 둘 다**

검증용 스모크 페이지는 프로덕션 산출물에 그대로 들어간다. 두 겹으로 막는다.

- `meta[name=robots][content="noindex, nofollow"]` — 경로 접두사(`/smoke`)로 **자동 판정**한다
  (`isIndexablePath`). 스모크 페이지를 새로 추가하는 사람이 메타를 잊을 수 없다.
- `public/robots.txt` 의 `Disallow: /smoke/` — 크롤 자체를 줄인다.

robots.txt 만으로는 부족하다(크롤이 막혀도 외부 링크로 색인될 수 있다). meta 만으로도 부족하다
(크롤 예산을 계속 먹는다). 그래서 둘 다 건다.

> **사이트맵(NOR-30) 방침**: 사이트맵 생성 시 `/smoke/*` 는 **제외**한다. `robots.txt` 의
> `Sitemap:` 참조 줄도 NOR-30 에서 붙인다.

### 4. OG 이미지 폴백 — **정적 기본 이미지 1장**

per-글 OG 이미지 **생성**(Satori)은 NOR-28 범위라 여기서 만들지 않는다. 대신
`public/og-default.png`(1200×630) 한 장을 폴백으로 두고, `SeoInput.image` 를 열어 둔다.

- `image` 를 주지 않으면 → `DEFAULT_OG_IMAGE`(`/og-default.png`) 를 절대화해 쓴다.
- `image` 가 루트 상대 경로면 → `Astro.site` 기준 절대화.
- `image` 가 이미 `http(s)` 절대 URL 이면 → 그대로 쓴다.

NOR-28 은 글마다 생성한 이미지 경로를 `image` 로 넘기기만 하면 된다. 메타 구조는 손대지 않는다.
`og:image` 를 아예 생략하는 선택지도 있었지만, 그러면 그때까지 모든 SNS 공유가 빈 카드로 나가고
절대 URL 조립 경로가 산출물에서 한 번도 검증되지 않는다.

### 5. 제목 규칙 — `<맨 제목> · gze1206.net`

- 페이지는 **사이트 이름을 붙이지 않은 맨 제목**만 넘긴다. 접미사는 `formatTitle` 이 붙인다.
- 맨 제목이 없거나 사이트 이름과 같으면(홈) → `gze1206.net` 하나만. `gze1206.net · gze1206.net` 이 되지 않는다.
- 이미 접미사가 붙은 문자열이 들어와도 중복해 붙이지 않는다(방어).

### 6. description 은 비지 않는다

- 분류 페이지는 프론트매터 description 이 없으므로 **항목 이름과 개수로 문장을 만든다**
  (예: `'dev' 카테고리로 분류된 글 5개를 모았습니다.`).
- 시리즈는 컬렉션의 `description` 을 그대로 쓴다.
- 목록 2페이지 이후는 페이지 번호를 문장에 넣어 페이지끼리 description 이 겹치지 않게 한다.
- 그래도 빈 문자열이 들어오면 `buildSeoMeta` 가 `DEFAULT_DESCRIPTION` 으로 되돌린다(마지막 방어선).

### 7. `article:modified_time` 은 항상 낸다

화면 표시는 `isUpdated` 가 false 면 수정일을 감춘다(NOR-17). 하지만 OG 는 감추지 않는다 —
`updatedAt` 은 스키마 필수 필드라 항상 실재하는 값이고, 크롤러에게는 "수정 이력 없음"보다
"발행일과 같음"이 더 정확한 정보다. 값은 `derivePostDetail()` 의 `publishedISO`/`updatedISO` 를
**재사용**한다(다시 계산하지 않는다).

## 성공 / 실패 조건

- 성공
  - `dist` 전 페이지에서 `<title>` · `meta[name=description]` · `link[rel=canonical]` 개수가 **각각 정확히 1**.
  - canonical 이 자기 자신을 가리킨다(특히 `/blog/2` → `.../blog/2`).
  - `canonical` · `og:url` · `og:image` 가 전부 `https://gze1206.net/...` 절대 URL.
  - 글 상세는 `og:type=article` + `article:published_time` + `article:modified_time`, 그 외는 `og:type=website`.
  - `<html lang="ko">`, `og:locale=ko_KR`, `twitter:card=summary_large_image`.
  - `/smoke/*` 6개 페이지가 `noindex, nofollow`, 그 외 전 페이지가 `index, follow`.
- 실패·예외
  - `Astro.site` 가 없으면 `absoluteUrl` 이 **빌드를 세운다**. 상대 URL 을 조용히 내보내는 것보다 낫다.

## 엣지 케이스

- **한글 슬러그** — `/tags/웹-성능` 은 `new URL()` 이 퍼센트 인코딩한다. `routes.ts` 의
  `encodeURIComponent` 결과와 같은 문자열이 나온다(둘 다 UTF-8 퍼센트 인코딩).
- **루트 경로** — `/` 는 슬래시를 떼지 않는다. canonical 은 `https://gze1206.net/`.
- **경로 끝 슬래시 / 중복 슬래시** — `//blog//` 같은 입력도 `/blog` 로 정규화된다.
- **홈의 제목 중복** — 5번 규칙으로 차단.
- **빈 description** — 6번 마지막 방어선으로 차단.
- **글이 0개일 때** — `/blog` 는 항상 생성되고(NOR-16), 메타도 정상적으로 붙는다.

## 검증 방법 (= TDD 테스트 목록)

`src/lib/site-meta.test.ts`

- [x] `formatTitle` — 맨 제목에 ` · gze1206.net` 을 붙인다.
- [x] `formatTitle` — 제목이 없거나 사이트 이름과 같으면 `gze1206.net` 하나만 낸다.
- [x] `formatTitle` — 이미 접미사가 붙은 제목에 두 번 붙이지 않는다.
- [x] `normalizePath` — 끝 슬래시를 뗀다 / 루트는 유지 / 중복 슬래시를 접는다 / 선행 슬래시를 채운다.
- [x] `absoluteUrl` — `Astro.site` 기준 절대 URL, 슬래시가 겹치거나 빠지지 않는다.
- [x] `absoluteUrl` — 한글 경로를 퍼센트 인코딩하고 `routes.ts` 결과와 일치한다.
- [x] `absoluteUrl` — `site` 가 없으면 던진다.
- [x] `isIndexablePath` — `/smoke`, `/smoke/cil` 은 false, `/`, `/blog`, `/blog/smoke-test` 는 true.
- [x] `buildSeoMeta` — canonical 이 자기 자신(`/blog/2` → `.../blog/2`).
- [x] `buildSeoMeta` — 기본 `og:type=website`, 글은 `article` + 발행/수정 시각.
- [x] `buildSeoMeta` — `article` 시각은 `og:type=article` 일 때만 나간다.
- [x] `buildSeoMeta` — 빈/공백 description 을 기본 문구로 되돌린다.
- [x] `buildSeoMeta` — og:image 기본값 · 루트 상대 경로 · 외부 절대 URL 3가지 경로.
- [x] `buildSeoMeta` — `/smoke/*` 와 `noindex` 프롭이 `noindex, nofollow` 를 만든다.
- [x] `buildSeoMeta` — twitter 카드는 항상 `summary_large_image`.

산출물(dist) 검증 — PR 본문에 grep 출력을 남긴다.

- [x] 전 페이지 title/description/canonical 개수 = 1
- [x] canonical == 자기 경로 (`/blog/2` 포함)
- [x] canonical·og:url·og:image 전부 절대 URL
- [x] 글 상세 `article` + published/modified, 목록 `website`
- [x] `<html lang="ko">` 전 페이지
- [x] `/smoke/*` noindex + robots.txt Disallow
- [x] 페이지 수·라우트가 v4 와 동일(회귀 없음)

## 구현 계획 (plan)

1. `src/lib/site-meta.ts` + `site-meta.test.ts` — 순수 로직(제목·경로·절대 URL·색인 판정·메타 조립).
2. `src/components/SeoMeta.astro` — `SeoMeta` 를 태그로 렌더하는 유일한 지점.
3. `BaseLayout` 이 `SeoMeta` 를 호출하도록 교체(기존 `<title>`/description 제거).
4. `ListLayout` · `PostLayout` 을 통과 계층으로 정리 — 하드코딩된 ` · gze1206.net` 제거.
5. 페이지들이 맨 제목 + 의미 있는 description 을 넘기도록 수정.
6. `public/robots.txt` · `public/og-default.png` 추가, `astro.config.mjs` 에 `trailingSlash: 'never'`.
7. `pnpm lint / format:check / test / build` → dist 전수 검증.

## 완료 조건 (일감)

- [x] 페이지별 title/description
- [x] canonical, robots, 언어(lang=ko)
- [x] OG/Twitter 카드 메타 공통 컴포넌트

## 범위 밖

- OG 이미지 자동 생성(Satori) — NOR-28
- JSON-LD — NOR-29
- RSS/Atom · 사이트맵 · `robots.txt` 의 `Sitemap:` 줄 — NOR-30
- 테마/디자인 — NOR-24
