---
issue: NOR-18
title: 시리즈 내비게이션 (이전/다음 편)
status: done
---

# NOR-18 — 시리즈 내비게이션 (이전/다음 편)

> Linear: https://linear.app/noru-kim/issue/NOR-18
> 결정 근거: [ADR 0011](../decisions/0011-series-navigation-derivation.md)

## 목표

시리즈에 속한 글의 상세 페이지 본문 뒤에 **그 시리즈의 글 목록·순서, 이전/다음 편 이동,
진행도(N/총)** 가 붙는다. 세 값은 모두 **하나의 "노출 대상" 목록**에서 파생되므로,
draft 가 시리즈 중간에 끼어 있어도 셋이 서로 어긋나거나 404 를 가리키지 않는다.

## 입력 / 출력

**입력** — `buildSeriesNav(visiblePosts, currentSlug)`

| 값             | 출처                                                                |
| -------------- | ------------------------------------------------------------------- |
| `visiblePosts` | `getVisiblePosts()` — draft 필터의 단일 지점(NOR-16, ADR 0009)      |
| `currentSlug`  | 현재 글의 프론트매터 slug (`/blog/[slug]` 의 `params.slug` 와 동일) |

**출력** — `SeriesNavigation<T> | null`

| 필드       | 내용                                                                    |
| ---------- | ----------------------------------------------------------------------- |
| `items`    | `{ post, position, isCurrent }[]` — 노출 대상만, `seriesOrder` 오름차순 |
| `total`    | 노출 대상 편 수 (= `items.length`)                                      |
| `position` | 현재 글이 노출 대상 목록에서 몇 번째인가 (1부터)                        |
| `previous` | 노출 대상 기준 **바로 앞** 글. 없으면 `undefined`                       |
| `next`     | 노출 대상 기준 **바로 뒤** 글. 없으면 `undefined`                       |

`null` 인 경우(= 내비게이션 블록 자체를 렌더하지 않는다):

- 현재 글이 시리즈에 속하지 않는다.
- 현재 글이 `visiblePosts` 에 없다(방어. 정상 흐름에서는 일어나지 않는다).
- 그 시리즈의 **노출 대상이 1편뿐**이다 — 이전/다음이 둘 다 없고 "1/1" 목록은 정보가 아니다.
  헤더의 시리즈 소속 표시가 이미 소속을 알려준다. 근거는 [ADR 0011](../decisions/0011-series-navigation-derivation.md).

## 동작 / 상태 전이

```
getVisiblePosts()                       ← draft 필터 단일 지점 (dev 포함 / build 제외)
   │
   ▼
buildSeriesNav(visiblePosts, slug)
   │
   ├─ 현재 글 찾기 → series 없으면 null
   ├─ selectSeriesPosts(visiblePosts, seriesId)   ← 같은 목록에서 파생 (NOR-16 재사용)
   ├─ index = 필터된 목록에서의 위치              ← 원본 seriesOrder 의 ±1 이 아니다
   └─ previous = [index-1], next = [index+1], total = length, position = index+1
   ▼
<SeriesNav nav={…} />  →  PostLayout 의 <slot name="after-content">
```

### draft 가 순서를 관통하는 경우 (핵심)

`seriesOrder` 1·2·3·4 중 **3편이 draft** 라면 프로덕션 빌드에는 3편의 페이지가 없다.

| 기준                       | 2편의 "다음 편" | 진행도(2편) |
| -------------------------- | --------------- | ----------- |
| 원본 `seriesOrder` ±1 (❌) | 3편 → **404**   | 2/4         |
| 노출 대상 목록의 인접 (✅) | **4편**         | **2/3**     |

dev 서버에서는 draft 가 노출 대상이므로 같은 글이 `2/4`, 다음 편은 3편이 된다.
**이것은 의도된 차이다** — 값이 달라지는 것은 입력(`visiblePosts`)이 달라졌기 때문이고,
한 페이지 안의 목록·이전/다음·진행도는 언제나 **같은 목록 하나**에서 나온다.

표시되는 편 번호(`position`)도 `seriesOrder` 가 아니라 노출 대상 목록의 인덱스다.
`/series/[slug]` 페이지가 이미 `index + 1` 을 "N편"으로 쓰고 있어 두 화면의 번호가 일치한다.

## 성공 / 실패 조건

- **성공**
  - 시리즈 중간 편에서 이전·다음 링크가 모두 나오고, 두 href 가 **실제로 생성된 페이지**를 가리킨다.
  - 중간 편이 draft 면 이전/다음이 그 편을 **건너뛴다**.
  - 첫 편에 이전이 없고, 마지막 편에 다음이 없다(빈 자리를 비활성 버튼으로 채우지 않는다).
  - 진행도의 분모가 **노출 대상 편 수**와 같다.
  - 시리즈 미소속 글에는 블록이 없다.
- **실패·예외**
  - 참조 무결성(`series` 오타)·`seriesOrder` 중복은 이 일감 이전에 이미 빌드가 세운다
    (`assertSeriesIntegrity`, NOR-16). 여기서 다시 검사하지 않는다.
  - `buildSeriesNav` 는 예외를 던지지 않는다. 판단할 수 없으면 `null` 을 돌려주고 렌더를 생략한다.

## 엣지 케이스

| 상황                                 | 기대 동작                                                      |
| ------------------------------------ | -------------------------------------------------------------- |
| 시리즈 미소속                        | 블록 전체 미렌더                                               |
| 노출 대상 1편                        | 블록 전체 미렌더 (`null`)                                      |
| 첫 편                                | `previous === undefined` → 이전 링크 자리 자체를 만들지 않는다 |
| 마지막 편                            | `next === undefined` → 다음 링크 자리 자체를 만들지 않는다     |
| 중간 편 draft                        | 앞뒤가 서로를 가리킨다(draft 를 건너뛴다)                      |
| 첫 편 draft                          | 2편이 `position 1`, `previous` 없음                            |
| 마지막 편 draft                      | 직전 편이 마지막이 되고 `next` 없음                            |
| `seriesOrder` 가 1,2,4 처럼 띄엄띄엄 | `position` 은 1,2,3 (번호가 아니라 순서다)                     |
| 다른 시리즈 글이 섞인 입력           | 현재 글의 시리즈만 걸러 쓴다                                   |
| 20편 이상 긴 시리즈                  | 목록을 `<details>` 로 접어 본문 흐름을 끊지 않는다 (ADR 0011)  |

## 접근성 계약

- 이전/다음은 `<nav aria-label="시리즈 내비게이션">`. **링크의 접근 가능한 이름에 글 제목이 포함**된다
  ("이전 편 · <제목>"). 방향 기호(`←`/`→`)는 `aria-hidden`.
- 목록의 **현재 글은 링크가 아니다.** `aria-current="true"` 로 표시하고, 눈에 보이는 "현재" 배지는
  `aria-hidden`(같은 정보를 두 번 읽지 않게).
- 진행도는 보이는 텍스트 `3 / 4` + 스크린리더용 `전체 4편 중 3번째 글`(`sr-only`).
- 블록 제목은 `h2`. 본문 헤딩과 같은 레벨이지만 **목차(TOC)에는 섞이지 않는다** —
  TOC 는 `render()` 가 돌려준 본문 `headings` 에서만 만들어지고, 레이아웃/컴포넌트 헤딩은 거기 없다
  (검증 항목에 dist grep 으로 포함).
- 내부 링크이므로 `target="_blank"` 를 쓰지 않는다. 경로는 `routes.ts` 의 `postPath()` 로만 만든다.
- 접기는 `<details>/<summary>` — **JS 없이** 동작하고 키보드(Tab → Enter/Space)로 열린다.

## 검증 방법 (= TDD 테스트 목록)

`src/lib/series-nav.test.ts`

- [x] 시리즈 미소속 글이면 `null`
- [x] 노출 대상이 1편뿐이면 `null`
- [x] 중간 편: `previous`/`next` 가 앞뒤 편을 가리킨다
- [x] 첫 편: `previous` 없음 / 마지막 편: `next` 없음
- [x] **중간 편 draft**: 프로덕션 입력에서 앞뒤가 서로를 가리킨다(3편 건너뜀)
- [x] **첫 편 draft**: 2편이 첫 편이 되고 `previous` 없음
- [x] **마지막 편 draft**: 직전 편이 마지막이 되고 `next` 없음
- [x] 진행도 `total` 이 노출 대상 수와 같다(원본 편 수가 아니다)
- [x] 같은 글이라도 dev(draft 포함) 입력에서는 `position`/`total` 이 달라진다
- [x] `position` 은 `seriesOrder` 값이 아니라 필터된 목록의 순서다
- [x] `items` 의 `isCurrent` 는 정확히 하나이고 현재 글이다
- [x] 다른 시리즈 글이 섞여 있어도 무시한다
- [x] `items` 순서 = `previous`/`next` 파생 근거와 동일한 목록(일관성)

빌드 산출물(`dist/`) 검증 — PR 본문에 grep 출력으로 남긴다

- [x] 시리즈 중간 편 상세에 이전/다음 링크가 있고, 두 href 의 디렉터리가 `dist/blog/` 에 실제로 있다
- [x] 픽스처 시리즈(중간 편 draft)에서 이전/다음이 draft 편을 건너뛴다
- [x] 첫 편에 "이전 편" 링크가 없고, 마지막 편에 "다음 편" 링크가 없다
- [x] 시리즈 미소속 글의 HTML 에 `시리즈 내비게이션` 이 없다
- [x] 진행도 분모가 노출 대상 수와 같다
- [x] 상세 페이지의 목차(`nav[aria-label="목차"]`)에 시리즈 블록 헤딩이 섞이지 않는다

## 구현 계획 (plan)

1. `docs/spec/NOR-18-series-nav.md`(이 문서) + [ADR 0011](../decisions/0011-series-navigation-derivation.md).
2. `src/lib/series-nav.test.ts` 를 먼저 쓴다(Red) — draft 3종 시나리오 포함.
3. `src/lib/series-nav.ts` — `buildSeriesNav()`. `selectSeriesPosts()`(NOR-16) 재사용.
4. `src/components/SeriesNav.astro` — 진행도 + `<details>` 목록 + 이전/다음 `<nav>`.
5. `src/pages/blog/[slug].astro` 의 `getStaticPaths` 에서 nav 를 만들어 props 로 넘기고,
   `PostLayout` 의 `<slot name="after-content">` 에 꽂는다(레이아웃 자체는 손대지 않는다).
6. 검증용 픽스처: 시리즈 `series-nav-fixture` 3편, **가운데 편이 draft**.
7. `pnpm lint` / `format:check` / `test` / `build` + `dist/` grep 검증.

## 완료 조건 (일감)

- [x] 시리즈 소속 글 목록/순서 표시
- [x] 이전/다음 편 이동
- [x] 시리즈 진행도(N/총) 표시
