---
number: 0013
title: canonical URL 정책 — trailing slash 없음 · 페이지네이션은 자기 자신
status: accepted
date: 2026-07-22
related: [NOR-27]
---

# 0013. canonical URL 정책 — trailing slash 없음 · 페이지네이션은 자기 자신

## 맥락 (Context)

NOR-27 이 전 페이지에 `link[rel=canonical]` 을 붙인다. canonical 은 "이 콘텐츠의 **정본 주소**는
여기다"라고 검색엔진에 선언하는 값이라, 한 번 색인된 뒤에 바꾸면 URL 이 통째로 갈아엎어진다.
그래서 붙이기 전에 두 가지를 못박아야 한다.

**1. trailing slash.** 이 사이트는 Astro 기본값인 `build.format: 'directory'` 로 빌드한다 —
`/blog` 는 `dist/blog/index.html` 로 나온다. 그러면 같은 문서가 `/blog` 와 `/blog/` 두 주소로
접근 가능하고, canonical 이 어느 쪽을 가리키느냐가 정본을 결정한다. 지금 정하지 않으면
페이지마다 다른 모양이 섞인다.

**2. 페이지네이션.** `/blog/2`, `/blog/3` 의 canonical 을 어디로 걸 것인가. 목록 페이지를
"같은 콘텐츠의 변형"으로 보고 1페이지(`/blog`)로 접는 방식이 흔히 쓰이는데, 이건 오답이다.

## 검토한 대안 (Options)

### trailing slash

- **A안 — 없음 `/blog` (채택)**
  - 장점: NOR-16 이 만든 `src/lib/routes.ts` 가 이미 슬래시 없는 경로(`/blog`, `/blog/2`,
    `/category/dev`)를 내보낸다. 사이트가 스스로 거는 **내부 링크와 canonical 이 같은 문자열**이 된다.
  - 장점: 배포 대상인 Cloudflare Pages 는 `/foo` 와 `/foo/` 를 **동등하게 취급**해 둘 다
    `foo/index.html` 로 라우팅한다([Pages routing 문서](https://developers.cloudflare.com/pages/functions/routing/)).
    즉 호스트가 한쪽으로 강제 리디렉트하지 않으므로, **정본을 고르는 일은 전적으로 우리 몫**이다 —
    그렇다면 사이트가 실제로 거는 링크와 같은 모양을 고르는 것이 맞다.
  - 단점: 루트만 예외(`https://gze1206.net/`)라 정규화 함수에 분기가 하나 생긴다.
- **B안 — 항상 있음 `/blog/`**
  - 장점: `build.format: 'directory'` 의 디렉터리 구조와 문자 그대로 일치한다.
  - 단점: `routes.ts` 의 모든 링크와 그 단위 테스트를 고쳐야 한다. 내부 링크(`/blog`)와
    canonical(`/blog/`)이 달라지면 크롤러가 매 링크마다 리디렉트를 한 번씩 더 탄다.
- **C안 — 정하지 않음(Astro 기본 `trailingSlash: 'ignore'` 유지)**
  - 단점: 정책이 없다는 뜻이다. `Astro.url.pathname` 이 주는 모양을 그대로 흘리면 라우트 종류에
    따라 섞이고, 그 사실이 산출물을 열어보기 전엔 드러나지 않는다.

### 페이지네이션 canonical

- **A안 — 각 페이지가 자기 자신 (채택)**
  - 장점: 2페이지 이후의 글 링크가 색인 대상으로 남는다.
  - 단점: 목록 페이지 수만큼 색인 대상이 늘어난다(얇은 페이지 우려).
- **B안 — 전부 1페이지(`/blog`)를 가리킴**
  - 단점: **치명적.** canonical 은 "이 URL 대신 저 URL 을 색인하라"는 지시다. `/blog/2` 가 `/blog` 를
    가리키면 크롤러는 `/blog/2` 를 색인 대상에서 지우고, 그 페이지에서만 링크되는 11번째 이후 글들이
    발견 경로를 잃는다. 글이 늘어날수록 색인에서 빠지는 글이 늘어난다.

## 결정 (Decision)

- canonical 은 **trailing slash 를 붙이지 않는다.** 루트(`/`)만 예외다.
- **모든 페이지의 canonical 은 자기 자신**이다. 페이지네이션도 예외가 아니다 —
  `/blog/2` 의 canonical 은 `https://gze1206.net/blog/2` 다.
- 정책은 `src/lib/site-meta.ts` 의 `normalizePath()` / `absoluteUrl()` 순수 함수 **한 곳**이 강제하고,
  `astro.config.mjs` 의 `trailingSlash: 'never'` 가 dev 서버까지 같은 규칙으로 맞춘다.

## 근거 (Rationale)

두 결정 모두 **"canonical 은 관찰이지 편집이 아니다"** 라는 한 원칙에서 나온다. canonical 은
이 페이지가 실제로 존재하는 주소를 그대로 적는 값이고, 페이지를 묶거나 감추는 도구가 아니다.

- trailing slash — 사이트가 스스로 거는 링크가 이미 `/blog` 다. canonical 이 `/blog/` 라면 사이트가
  자기 링크와 다른 주소를 정본이라고 말하는 셈이다. 호스트는 둘을 구분하지 않으니 어긋남을 막는 것은
  우리 코드뿐이고, 그 코드는 한 곳(`normalizePath`)에만 두는 편이 안전하다.
- 페이지네이션 — `canonical = absoluteUrl(현재 경로)` 라는 **한 줄 규칙**이라 "이 라우트만 예외"를
  만들 여지가 없다. 규칙에 예외가 없으면 새 라우트를 추가하는 사람이 실수할 수 없다.
- `/blog` 와 `/blog/1` 이 동시에 존재하지 않는 것은 NOR-16 의 `blogPagePath()`(ADR 0009)가 이미
  보장한다. 그래서 "자기 자신"이 곧 유일한 주소다 — 중복 URL 문제는 애초에 발생하지 않는다.

얇은 페이지 우려는 실재하지만, 그 대가는 **글이 색인에서 빠지는 것**보다 훨씬 작다. 목록 페이지
자체의 순위는 이 블로그의 목표가 아니다.

## 영향 (Consequences)

- 긍정: 내부 링크 · canonical · 실제 생성 경로 · 호스트 서빙 URL 이 전부 한 벌로 맞는다.
- 긍정: 후속 일감(NOR-29 JSON-LD, NOR-30 사이트맵/RSS)이 같은 `absoluteUrl()` 을 쓰면 URL 모양이
  자동으로 일치한다. 각자 문자열을 조립하면 반드시 어긋난다.
- 부정/비용: 루트 예외 때문에 정규화 함수에 분기가 하나 있다. 단위 테스트로 고정했다.
- 부정/비용: 목록 페이지가 색인 대상에 남는다. 얇은 페이지 지적이 실제로 문제가 되면 그때
  `robots` 의 `noindex, follow`(색인은 막고 링크는 따라가게)로 조정한다 — canonical 로 접지 않는다.
- 후속: NOR-30 의 사이트맵도 같은 정규화를 거친 URL 을 넣는다. `/smoke/*` 는 사이트맵에서 제외한다
  (`isIndexablePath()` 재사용).
