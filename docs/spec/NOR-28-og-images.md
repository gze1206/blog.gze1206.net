---
issue: NOR-28
title: OG 이미지 자동생성 (Satori)
status: done # draft | in-progress | done
---

# NOR-28 — OG 이미지 자동생성 (Satori)

> Linear: https://linear.app/noru-kim/issue/NOR-28

## 목표

색인 대상 **모든 페이지**가 자기 내용을 담은 1200×630 OG 이미지를 갖는다. 이미지는
**빌드타임에 파일로** 만들어지고(정적 전제 유지, ADR 0012), 한글 제목이 두부(□) 없이 렌더되며,
생성이 실패해도 빌드는 멈추지 않는다.

전략 결정과 근거는 **[ADR 0014](../decisions/0014-og-image-generation-strategy.md)** 참고.

## 입력 / 출력

- 입력
  - 콘텐츠에서 파생한 카드 재료: 글 제목·시리즈 이름 / 목록·분류 제목·설명 / 브랜드 문자열.
  - `src/assets/fonts/Pretendard-{Regular,Bold}.otf` (저장소 안. 네트워크를 타지 않는다).
- 출력
  - `dist/og/**/*.png` — 1200×630 PNG.
  - 각 페이지의 `<head>`: `og:image`(절대 URL) · `og:image:type` · `og:image:width` ·
    `og:image:height` · `og:image:alt` · `twitter:image` · `twitter:image:alt`.

## 동작 / 상태 전이

```
                       ┌──────────────── 같은 함수를 쓴다 ────────────────┐
                       ▼                                                  ▼
페이지 ─> buildSeoMeta ─> ogImagePath('/blog/x') = '/og/blog/x.png'   buildOgTargets ─> 생성 목록
                                     │                                    │
                                     ▼                                    ▼
                        <meta property="og:image" …>          src/pages/og/[...path].png.ts
                                                                          │
                                            buildOgCard ─> Satori(SVG) ─> sharp(PNG) ─> dist/og/**
                                                                          │
                                                          (실패) ─> 경고 + public/og-default.png
```

| 계층                                 | 책임                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| `src/lib/og-text.ts`                 | 폭 추정 · 줄바꿈 · 말줄임 · **제목 글자 크기 선택** (순수, 단위 테스트)      |
| `src/lib/og-card.ts`                 | 규격 상수 · 디자인 토큰 · 템플릿 3종의 요소 트리 (순수, 단위 테스트)         |
| `src/lib/og-targets.ts`              | "어떤 경로에 어떤 카드" 목록 (순수, 단위 테스트)                             |
| `src/lib/og-cache.ts`                | 내용 주소 바이너리 온디스크 캐시 (never throws)                              |
| `src/lib/og-render.ts`               | 폰트 로드 · Satori · sharp · 캐시 · 폴백                                     |
| `src/pages/og/[...path].png.ts`      | `astro:content` ↔ 순수 계층이 만나는 유일한 지점. 정적 파일로 떨어진다       |
| `src/lib/routes.ts`                  | `ogImagePath` / `ogImageParam` — 경로 규칙의 단일 출처                       |
| `src/lib/site-meta.ts`               | 색인 대상이면 규칙대로 `og:image` 를 채운다(페이지는 아무것도 넘기지 않는다) |
| `src/integrations/og-image-audit.ts` | 빌드 후 dist 의 `og:image` 참조가 실재하는지 대조(경고만)                    |

### 경로 규칙

사이트 트리를 그대로 `/og` 아래에 복사하고 `.png` 를 붙인다.

| 페이지              | OG 이미지                         |
| ------------------- | --------------------------------- |
| `/`                 | `/og/index.png`                   |
| `/blog`             | `/og/blog.png`                    |
| `/blog/2`           | `/og/blog/2.png`                  |
| `/blog/hello-world` | `/og/blog/hello-world.png`        |
| `/tags/웹-성능`     | `/og/tags/웹-성능.png`            |
| `/smoke/*`          | (만들지 않음 → `/og-default.png`) |

### 템플릿 3종

| kind    | 쓰는 곳                      | 구성                          |
| ------- | ---------------------------- | ----------------------------- |
| `post`  | 글 상세                      | (시리즈 이름) + 제목 + 브랜드 |
| `list`  | 홈·목록·카테고리·태그·시리즈 | 라벨 + 제목 + 설명 + 브랜드   |
| `about` | About 페이지 (NOR-21)        | 라벨 + 이름 + 소개 + 브랜드   |

`about` 은 **페이지가 아직 없다.** 템플릿과 테스트만 있고 라우트는 만들지 않았다 —
없는 페이지에 URL 을 주지 않기 위해서다. NOR-21 이 `/about` 을 만들면
`buildOgTargets` 에 `target('/about', { kind: 'about', … })` 한 줄을 더하면 붙는다.

디자인은 의도적으로 얕다. 베이스 테마는 NOR-24 에서 확정되므로, 색·간격은 전부
`OG_THEME` 한 곳에 모아 두고 그때 값만 갈아끼운다.

## 성공 / 실패 조건

- 성공
  - 색인 대상 페이지마다 1200×630 PNG 가 `dist` 에 있고, 그 페이지의 `og:image` 절대 URL 이 그 파일을 가리킨다.
  - 한글(희귀 음절 포함)이 두부 없이 렌더된다.
  - 아주 긴 제목이 카드 밖으로 새지 않고 `…` 로 마무리된다. 아주 짧은 제목도 어색하지 않다.
  - `pnpm lint` / `format:check` / `test` / `build` 통과, NOR-27 메타 무결성 무회귀.
- 실패·예외
  - 렌더 실패 → **예외를 올리지 않는다.** 경고 + `public/og-default.png` 바이트로 응답.
  - 폰트 파일이 없거나 깨짐 → 같은 폴백(전체 카드가 기본 이미지가 되지만 빌드는 끝난다).
  - `og-default.png` 마저 못 읽음 → sharp 로 단색 PNG 를 만들어 낸다(참조가 깨지는 것보단 낫다).
  - 규칙과 생성 목록이 어긋남 → `og-image-audit` 이 경고로 알린다(빌드는 세우지 않는다).

## 엣지 케이스

- **아주 긴 한글 제목** — 글자 크기를 66 → 58 → 50 → 44 px 로 낮춰 3줄에 맞추고, 그래도 넘치면
  Satori 의 `lineClamp` 이 `…` 로 자른다. 160자를 넘는 제목은 그 전에 하드 컷.
- **아주 짧은 제목**(1자) — 가장 큰 글자 크기로 렌더. 레이아웃이 무너지지 않는다.
- **희귀 한글 음절**(뷁·뾃·쒫 …) — 서브셋하지 않은 원본 폰트라 전부 나온다.
- **한글 슬러그**(`/tags/웹-성능`) — 엔드포인트 파라미터는 **디코딩된 값**을 넘긴다. 이미
  인코딩된 값을 넘기면 `%` 가 다시 인코딩돼 `%25…` 파일이 생긴다.
- **시리즈 없는 글** — 라벨 줄 자체를 렌더하지 않는다(빈 줄이 남지 않는다).
- **글이 0편** — `/blog` 는 여전히 존재하므로 목록 카드도 만든다.
- **`/smoke/*`** — 색인 대상이 아니라 카드를 만들지 않고 메타도 정적 기본 이미지를 가리킨다.
- **템플릿 구조 변경** — 캐시 키에는 입력 + 테마 토큰이 들어간다. **구조**를 바꿨다면
  `og-render.ts` 의 `RENDERER_VERSION` 을 올린다.

## 검증 방법 (= TDD 테스트 목록)

순수 로직 — `src/lib/*.test.ts`

- [x] `charWidth` / `estimateTextWidth` — 한글 1em, 라틴은 그보다 좁다.
- [x] `wrapText` — 한글은 글자 단위, 라틴은 단어 단위, 초장문 단어는 강제 분할, 줄 끝 공백 제거.
- [x] `truncateChars` — 상한 초과 시 `…`, 이모지를 쪼개지 않음.
- [x] `fitTitle` — 짧은 제목은 큰 글자, 긴 제목은 줄어듦, 어떤 길이에도 던지지 않음, 하드 컷.
- [x] `buildOgCard` — 템플릿 3종이 각각 무엇을 담는지, 라벨 없으면 줄 없음, 긴 라벨·설명은 `…`,
      Satori 제약(다자식 요소에 `display`), **색은 테마 토큰에서만** 온다.
- [x] `buildOgTargets` — 홈·목록·분류·글이 모두 목록에 있음, `/blog/1` 없음, 경로 중복 없음,
      파라미터는 디코딩된 값, 경로는 `ogImagePath` 규칙과 동일.
- [x] `ogImagePath` / `ogImageParam` — 규칙·인코딩 보존·디코딩·잘못된 퍼센트에도 안 던짐.
- [x] `withBinaryCache` — 첫 호출만 producer, 키가 다르면 다른 항목, 바이너리 그대로,
      쓰기 실패에도 안 던짐, producer 실패는 캐시하지 않음.
- [x] `buildSeoMeta` — 색인 대상은 생성 카드, 비색인은 정적 폴백, 명시 이미지가 규칙을 이김,
      width/height/type/alt 동반.

파이프라인 — `src/lib/og-render.test.ts`

- [x] 실제로 1200×630 PNG 가 나온다(폰트·Satori·sharp 가 다 살아 있다).
- [x] 입력이 다르면 다른 이미지, 같으면 캐시 히트.
- [x] **Satori 가 던지도록 목킹**하면 예외 없이 `og-default.png` 바이트가 나오고 경고가 남는다.

빌드 산출물 — 눈과 스크립트로

- [x] `dist/og/**` 에 46장이 생기고 전부 `1200 x 630` PNG.
- [x] 모든 페이지의 `og:image` 가 실재 파일을 가리킨다 → `og-image-audit` 이 매 빌드마다 확인.
- [x] **생성된 PNG 를 직접 열어** 한글이 두부가 아닌지 확인(긴 제목·짧은 제목·희귀 음절 포함).
- [x] NOR-27 메타 무결성 무회귀 — 전 페이지 `title`/`description`/`canonical` 각 1개.

## 빌드 시간

카드 46장 기준 실측(같은 머신, 렌더 파이프라인만 격리해 측정):

| 구간                               | 시간        |
| ---------------------------------- | ----------- |
| 첫 장 (폰트 파싱·엔진 초기화 포함) | **1.11 s**  |
| 46장 전부 (캐시 없음)              | **11.62 s** |
| 46장 전부 (캐시 히트)              | **0.03 s**  |

즉 **도입 비용은 캐시가 빈 첫 빌드에서만** 약 12초이고, 그 뒤로는 바뀐 카드만 다시 그린다.

`astro build` 전체 시간은 이 저장소에서는 비교 기준으로 쓰기 어렵다 — 스모크 콘텐츠가 일부러
죽은 URL 을 fetch 하는 커스텀 블럭을 담고 있어(ADR 0008 검증용) 그 타임아웃이 전체 시간을
좌우하고, 머신 부하에 따라 같은 커밋이 38초에서 8분까지 흔들린다. 그래서 위처럼
**OG 렌더 구간만 격리해** 측정했다. 참고로 같은 빌드 로그 안에서 `/og/**` 라우트 생성 시간
합계는 캐시 없음 177 s → 캐시 있음 21 s 로 줄었고(같은 빌드의 HTML 페이지 생성 합계는
52 s → 29 s), 부하 보정 후에도 캐시가 OG 구간을 크게 줄이는 것이 확인된다.

## 구현 계획 (plan)

1. 폰트 선정·라이선스 확인 → `src/assets/fonts/` 에 커밋 + 출처 문서. (ADR 0014)
2. `og-text.ts` — 폭 추정·줄바꿈·말줄임·글자 크기 선택 (TDD).
3. `og-card.ts` — 규격·토큰·템플릿 3종 (TDD).
4. `og-cache.ts` — 바이너리 내용 주소 캐시 (TDD).
5. `og-render.ts` — 폰트 로드 · Satori · sharp · 폴백.
6. `routes.ts` 에 `ogImagePath`/`ogImageParam` 추가, `site-meta.ts` 를 규칙에 연결 + 규격/alt 메타.
7. `og-targets.ts` + `src/pages/og/[...path].png.ts` 로 실제 생성.
8. `og-image-audit` 통합으로 깨진 참조 감시.
9. 빌드 · 육안 검증 · 빌드 시간 측정.

## 완료 조건 (일감)

- [x] 글 제목/시리즈/브랜드로 OG 이미지 빌드타임 생성 (Satori)
- [x] 폰트 임베드(한글 포함) — 서브셋 없이 원본 임베드, 희귀 음절까지 렌더 확인
- [x] 목록/글/About 템플릿 — About 은 템플릿만(페이지는 NOR-21)
