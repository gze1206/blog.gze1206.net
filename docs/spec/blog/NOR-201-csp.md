# NOR-201 — 공개 블로그 CSP 와 댓글 서버 레이트 리밋

- 출처: NOR-200 보안 검수(Claude·Codex) 후속
- 관련: [NOR-200 명세](./NOR-200-comments.md), [댓글 서버 운영](../../operations/comments/oci.md)

## 결정

| 항목            | 결정                                                                                                                                  | 이유                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 적용 방식       | 빌드 뒤 `dist/_headers` 를 만들어 Cloudflare Pages 가 모든 경로에 CSP 헤더를 붙인다                                                   | 정적 사이트라 서버 코드가 없다. `<meta>` CSP 는 `frame-ancestors` 를 지원하지 않는다                             |
| 인라인 스크립트 | 산출물 HTML 의 인라인 스크립트마다 sha256 해시를 `script-src` 에 넣는다. `'unsafe-inline'` 은 쓰지 않는다                             | 테마 초기화·Astro island 로더가 인라인이다. 내용이 빌드마다 바뀔 수 있으므로 빌드 뒤에 계산한다                  |
| 인라인 스타일   | `style-src` 에 `'unsafe-inline'` 을 둔다                                                                                              | 스타일 속성이 600개가 넘고 Mermaid·KaTeX·Comentario 가 스타일을 주입한다. 스타일 주입의 위험은 스크립트보다 작다 |
| 단계            | Report-Only 로 먼저 배포해 실제 사이트에서 위반이 없는지 확인하고, 그 뒤 강제한다                                                     | 댓글 위젯처럼 e2e 가 대신(stub)하는 외부 동작은 실제 사이트에서만 확인할 수 있다                                 |
| 레이트 리밋     | Cloudflare Rate limiting rule: `comments.gze1206.net` 의 `PUT /api/embed/comments`, `POST /api/auth/login`, IP 당 10초 5회, 10초 차단 | Caddy 표준 빌드에는 레이트 리밋이 없다. 댓글 목록 조회(POST)는 제한하지 않는다                                   |

## 정책

```text
default-src 'self';
script-src 'self' 'wasm-unsafe-eval' https://comments.gze1206.net <인라인 해시들>;
style-src 'self' 'unsafe-inline' https://comments.gze1206.net;
img-src 'self' data: https://comments.gze1206.net https://i.ytimg.com;
font-src 'self' data:;
connect-src 'self' https://comments.gze1206.net wss://comments.gze1206.net;
frame-src https://www.youtube-nocookie.com;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

`'wasm-unsafe-eval'` 은 Pagefind 검색의 WebAssembly 때문이다. 문자열 `eval` 은 허용하지 않는다.

## 수용 기준

- **AC-1** `inlineScriptHashes(html)` 는 `src` 가 없는 실행 스크립트(`type` 없음·`module`)의 본문 sha256 을 `'sha256-…'` 형식으로 돌려준다. JSON 스크립트(`application/ld+json` 등)는 뺀다.
- **AC-2** `buildCsp(hashes)` 는 위 정책을 만들고, 해시를 중복 없이 정렬해 `script-src` 에 넣는다.
- **AC-3** `renderHeaders(policy, mode)` 는 Cloudflare Pages `_headers` 형식으로 `/*` 에 `Content-Security-Policy-Report-Only`(report-only) 또는 `Content-Security-Policy`(enforce) 를 쓴다.
- **AC-4** 빌드 뒤 `dist/_headers` 가 생기고, 모든 HTML 의 인라인 스크립트 해시가 들어 있다.
- **AC-5** 각 페이지에 그 페이지로 만든 정책을 **강제**로 걸었을 때 CSP 위반이 없다. 대상은 홈, 글 목록, 댓글이 있는 글, smoke 페이지(수식·Mermaid·코드·블록), 검색 팔레트, 테마 전환이다.
- **AC-6** (manual) 실제 사이트에서 Report-Only 로 위반이 없음을 확인한 뒤 enforce 로 바꾼다. 댓글 위젯 로드·테마 전환·검색을 포함한다.
- **AC-7** (manual) 레이트 리밋 규칙이 로그인 반복을 429(Cloudflare 1015)로 막고, 댓글 목록 조회는 막지 않는다.
