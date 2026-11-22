# NOR-234 — 블로그에 GA4 와 끝까지 읽음 측정 넣기

- 출처: 사용자 요청(2026-11-22). 방문 수보다 실제로 읽었는지(열고 나감·크롤러와 구별)를 알고 싶다.
- 측정 ID: `G-VPVRFS2P5S`(페이지에 그대로 노출되는 공개 값)

## 현재

- 통계는 Cloudflare Web Analytics 비컨뿐이다. 방문 수·유입 경로는 보이지만 체류와 읽기는 보이지 않는다.
- CSP(NOR-201)는 자체 출처, 댓글 서버, Cloudflare 비컨만 허용한다.

## 결정

| 항목        | 결정                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 싣는 곳     | 운영 도메인 `gze1206.net` 에서만 싣는다. 미리보기·로컬·e2e 는 GA 로 아무것도 보내지 않는다                                   |
| 싣는 시점   | `load` 뒤 브라우저가 한가할 때 싣는다. 첫 화면 그리기를 막지 않는다                                                          |
| 광고 기능   | Google Signals 와 광고 개인화를 끈다. CSP 는 Google 안내의 "광고 기능 없는 GA" 목록만 연다                                   |
| 끝까지 읽음 | 글 본문 끝에 닿고, 탭이 보이는 시간이 `max(15초, 예상 읽는 시간 × 0.5)` 이상이면 `read_complete` 를 한 번 보낸다             |
| 이벤트 값   | `reading_minutes`(예상), `engaged_seconds`(실제로 보인 시간)                                                                 |
| 고지        | `/privacy` 에 개인정보 처리방침을 두고 푸터에서 잇는다. 동의 배너는 두지 않는다(방문자 대부분이 한국이고 광고 기능을 끄므로) |
| 기존 통계   | Cloudflare Web Analytics 는 그대로 둔다                                                                                      |

## 수용 기준

- **AC-1** CSP 는 `script-src` 에 `https://www.googletagmanager.com`, `img-src` 에 그것과 `https://*.google-analytics.com`, `connect-src` 에 그 둘과 `https://*.google.com` 을 더한다. 광고 도메인(`doubleclick`, `googlesyndication`)은 넣지 않는다.
- **AC-2** GA 는 호스트가 정확히 `gze1206.net` 일 때만 싣는다. 로컬 미리보기에서는 `googletagmanager.com` 으로 요청이 나가지 않는다.
- **AC-3** GA 설정은 Google Signals 와 광고 개인화를 끈다.
- **AC-4** 끝까지 읽음은 본문 끝에 닿았고 보인 시간이 `max(15초, 예상 × 0.5)` 이상일 때만 참이다.
- **AC-5** 글 페이지는 조건을 채우면 `read_complete` 를 한 번만 보내고, 탭이 숨은 동안의 시간은 세지 않는다.
- **AC-6** `/privacy` 는 Google Analytics·Cloudflare Web Analytics·댓글 서버가 무엇을 모으는지와 거부 방법을 알리고, 모든 페이지 푸터가 그곳으로 잇는다.
