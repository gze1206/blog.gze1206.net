---
issue: NOR-17
title: 글 상세 — TOC + 헤딩 앵커, 읽기 시간, 작성/수정일
status: done
---

# NOR-17 — 글 상세: TOC + 헤딩 앵커, 읽기 시간, 작성/수정일

> Linear: https://linear.app/noru-kim/issue/NOR-17
> 결정 근거: [ADR 0010](../decisions/0010-heading-id-reading-time-toc-strategy.md)

## 목표

글 상세 페이지에서 **본문 헤딩마다 공유 가능한 앵커**가 생기고, **목차**로 글을 훑을 수 있으며,
**읽기 시간**과 **작성/수정일**이 표시된다. 그 파생 데이터는 Phase 7(JSON-LD·OG·RSS)이 그대로
꺼내 쓸 수 있는 형태로 한 곳에 모여 있다.

## 입력 / 출력

**입력**

| 값                   | 출처                                     |
| -------------------- | ---------------------------------------- |
| 글 메타(발행·수정일) | `post.data` (Content Collections, NOR-9) |
| 본문 원문            | `post.body`                              |
| 렌더된 헤딩 목록     | `render(post)` 의 `headings`             |

**출력** — `derivePostDetail(...)` 이 만드는 `PostDetail`:

| 필드           | 내용                                 | 소비자                      |
| -------------- | ------------------------------------ | --------------------------- |
| `toc`          | `h2`~`h3` 목차 트리(비면 렌더 안 함) | `TableOfContents.astro`     |
| `readingTime`  | `{ seconds, minutes, label, iso }`   | 상세 헤더 · Phase 7         |
| `publishedISO` | `YYYY-MM-DD`                         | `<time datetime>` · Phase 7 |
| `updatedISO`   | `YYYY-MM-DD`                         | `<time datetime>` · Phase 7 |
| `isUpdated`    | 수정일이 발행일과 다른가             | 표시 여부 판단 · Phase 7    |

## 동작 / 상태 전이

```
render(post)
   │  headings = [{ depth, slug, text }, …]        ← 렌더러가 실제로 붙인 id
   ▼
derivePostDetail({ publishedAt, updatedAt, body, headings })
   │
   ├─ buildToc(headings)            → h2~h3 만, 2개 미만이면 []
   ├─ estimateReadingTime(body)     → { seconds, minutes, label, iso }
   └─ toISODate(...)                → publishedISO / updatedISO
   ▼
PostLayout  →  헤더(날짜·읽기시간) + <TableOfContents entries={toc} /> + 본문
```

### 헤딩 id · 앵커가 붙는 두 경로

| 확장자  | 파이프라인                         | id·앵커를 붙이는 곳                                |
| ------- | ---------------------------------- | -------------------------------------------------- |
| `.md`   | remark → rehype (astro.config.mjs) | `src/rehype/heading-anchors.ts`                    |
| `.mdoc` | Markdoc 자체 렌더러                | `markdoc.config.mjs` 의 `nodes.heading` 오버라이드 |

둘 다 `src/lib/heading-id.ts` 의 `createHeadingIdFactory()` 와 `src/lib/heading-anchor.ts` 의
`headingAnchorLabel()` 을 쓴다. 그래서 **같은 본문이면 두 경로의 산출 HTML 이 같다.**

앵커 마크업(양쪽 동일):

```html
<h2 id="설치하기">
  설치하기<a class="heading-anchor" href="#설치하기" aria-label="설치하기 섹션 링크"></a>
</h2>
```

- **자식이 없다.** 텍스트를 넣으면 렌더러가 헤딩 텍스트를 모을 때 섞여 들어가 목차 텍스트가 오염된다.
- 보이는 `#` 는 CSS `::before` 가 그리고, 접근 가능한 이름은 `aria-label` 이 준다.
- 호버뿐 아니라 **`:focus-visible` 에서도 보인다.** 호버가 없는 기기에서는 항상 옅게 보인다.

## 성공 / 실패 조건

**성공**

- `.md` / `.mdoc` **양쪽** 상세 페이지에서 모든 본문 헤딩에 `id` 와 앵커가 붙는다.
- 목차 링크의 `href` 가 전부 실제 헤딩 `id` 와 일치한다(깨진 앵커 0건).
- 한 문서 안에 중복 `id` 가 없다.
- 읽기 시간이 렌더되고, 어떤 글에서도 "0분"이 나오지 않는다.
- 담을 헤딩이 2개 미만인 글에서는 목차가 렌더되지 않는다.

**실패·예외**

- 슬러그로 바꿀 수 없는 헤딩(`## ???`) → 빌드를 세우지 않고 `section` 으로 떨어뜨린 뒤 유일화.
- 같은 텍스트 헤딩 반복 → `-2`, `-3` … (이미 쓰인 후보는 건너뜀).
- 본문이 비었거나 `undefined` → 읽기 시간 `1분 미만` / `PT1M`.
- `.mdoc` 코드블럭 언어가 미리 로드되지 않음 → 경고를 남기고 `plaintext` 로 렌더(빌드는 계속).

## 엣지 케이스

| 케이스                                   | 처리                                        |
| ---------------------------------------- | ------------------------------------------- |
| 헤딩 0개 / 1개                           | 목차 렌더 안 함                             |
| `h2` 없이 `h3` 가 먼저 나옴              | 버리지 않고 최상위로 올림                   |
| `h4` 이하                                | 앵커는 붙이되 목차에는 담지 않음            |
| 같은 텍스트 헤딩 + 실제 `## 예제 2` 공존 | 이미 쓰인 id 는 건너뛰어 충돌 없음          |
| 기호만으로 된 헤딩                       | `section`, `section-2` …                    |
| 아주 긴 코드블럭                         | 읽기 시간은 블럭당 30줄까지만 가산          |
| 코드블럭 안의 다른 펜스 문자             | 코드의 일부로 취급(블럭이 일찍 끝나지 않음) |
| 닫히지 않은 코드블럭                     | 끝까지 코드로 취급                          |
| Markdoc `{% callout %}` 본문             | 마커만 제거하고 안의 산문은 분량에 포함     |
| 좁은 화면의 긴 목차                      | 목록 높이 `45vh` 제한 + 스크롤(CLS 없음)    |

## 검증 방법 (= TDD 테스트 목록)

### 단위 테스트

- [x] `heading-id.test.ts` — 한글 보존 / `toSlug` 와 동일 규칙 / 빈 슬러그 대체 / `-2` 유일화 /
      생성 id 와 실제 헤딩 충돌 / 문서별 카운터 격리
- [x] `reading-time.test.ts` — 빈 본문 / 1분 미만 / 한글 500자·영문 200단어 / 혼합 /
      코드블럭 줄 가산·상한 / 중첩·미닫힘 펜스 / 프론트매터·수식·이미지·인라인코드 제외 /
      Markdoc 마커 / 링크 URL 제외 / ISO duration / 결정성
- [x] `toc.test.ts` — h2 나열 / h3 중첩 / h1·h4 제외 / 고아 h3 승격 / 1개 이하 미렌더 /
      빈 id·빈 텍스트 제외 / 공백 정리
- [x] `post-detail.test.ts` — TOC 생성 여부 / 읽기 시간 하한 / ISO 날짜 / `isUpdated` / 결정성
- [x] `fence-languages.test.ts` — 언어 수집 / 중복 / `title=` 메타 / 중첩 펜스 / `~~~`

### 산출물(dist) 검증

`pnpm build` 후 `dist/blog/*/index.html` 을 직접 훑어 아래를 확인한다.

- [x] `.md`(`/blog/heading-anchors-md`) 와 `.mdoc`(`/blog/heading-anchors-mdoc`) 의
      헤딩 `id` 목록과 앵커 목록이 **완전히 동일**
- [x] 모든 목차 링크 `href` 가 본문 헤딩 `id` 에 존재(깨진 앵커 0건)
- [x] 문서별 중복 `id` 0건
- [x] 모든 상세 페이지에 읽기 시간 렌더, "0분" 0건
- [x] 헤딩 1개 이하 글(`typescript-strict-tips`, `hello-world`)에 목차 없음
- [x] 개발 서버에서 draft `.mdoc` 스모크 글도 동일하게 동작(코드블럭 하이라이팅 회귀 없음)

## 구현 계획 (plan)

1. 순수 로직 + 테스트 — `heading-id.ts`, `reading-time.ts`, `toc.ts`, `post-detail.ts`
2. `.md` 경로 — `src/rehype/heading-anchors.ts` + `astro.config.mjs` 등록(rehypeKatex 앞)
3. `.mdoc` 경로 — `markdoc.config.mjs` `nodes.heading` 오버라이드
4. `.mdoc` 의 `headings` 가 비는 문제 해결 — `fence` 트랜스폼 동기화 + 언어 사전 로드
5. UI — `TableOfContents.astro`, `PostLayout` 배선, `global.css`(앵커·목차·스크롤)
6. 픽스처 — `fixture-heading-anchors.md` / `.mdoc` (발행 상태로 두어 dist 로 검증 가능하게)
7. 검증 — lint / format / test / build + dist 훑기

## Phase 7(NOR-27~30)이 여기서 꺼내 쓸 것

JSON-LD 자체 구현은 이번 범위가 **아니다.** 대신 그때 계산을 다시 만들지 않도록 데이터를
`src/lib/post-detail.ts` 한 곳에 모아 두었다.

| JSON-LD / 메타 필드 | 여기서 쓸 값                                   |
| ------------------- | ---------------------------------------------- |
| `datePublished`     | `detail.publishedISO`                          |
| `dateModified`      | `detail.updatedISO` (`isUpdated` 로 생략 판단) |
| `timeRequired`      | `detail.readingTime.iso` (`PT3M`)              |
| 목차 기반 딥링크    | `detail.toc` (id + text)                       |

읽기 시간은 화면에도 `<time datetime="PT2M">약 2분</time>` 으로 나가므로, 구조화 데이터와
표시 값이 갈릴 수 없다.

## 범위 밖

- 시리즈 이전/다음 편 내비게이션·진행도 → **NOR-18** (같은 `PostLayout` 의 `after-content` 슬롯)
- JSON-LD·OG 이미지·사이트맵·RSS → **Phase 7 (NOR-27~30)**
- 목록/카테고리/태그/시리즈 페이지 구조 → **NOR-16** 에서 완료
- 스크롤 스파이 → 하지 않음. 근거는 [ADR 0010](../decisions/0010-heading-id-reading-time-toc-strategy.md)

## 완료 조건 (일감)

- [x] 헤딩 자동 앵커 + 목차(TOC)
- [x] 읽기 시간 계산
- [x] 작성일/수정일 표시(+ JSON-LD 연동 대비)
