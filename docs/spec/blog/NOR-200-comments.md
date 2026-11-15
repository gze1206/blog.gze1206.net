# NOR-200 — 댓글 서버 (하위 프로젝트 5)

- 상위 설계: [../../superpowers/specs/2026-11-12-monorepo-foundation-design.md](../../superpowers/specs/2026-11-12-monorepo-foundation-design.md) "하위 프로젝트" 5번
- 결정: [ADR 0019](../../decisions/0019-comment-server-comentario.md)
- 대체하는 일감: NOR-32(Waline)
- 운영 절차: [../../operations/comments/oci.md](../../operations/comments/oci.md)

## 결정

| 항목        | 결정                                                                                                | 이유                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 서버        | Comentario 3.19.0(`registry.gitlab.com/comentario/comentario`, digest 고정), SQLite                 | 이름만 받는 익명 댓글과 익명 댓글 사전 승인을 기본 기능으로 지원한다. Artalk 는 이메일이 필수다 |
| 호스트      | `https://comments.gze1206.net`. OCI 호스트의 공용 edge Caddy 에 `sites/comments.caddy` 로 붙는다    | 80·443 은 edge 가 소유한다. 공개 포트를 따로 열지 않는다                                        |
| 댓글 정책   | 가입 없이 이름만 받는다. 익명 댓글은 승인 뒤 공개한다. 이미지 마크다운과 Gravatar 는 끈다           | 메일 발송(SMTP)을 두지 않는다. 스팸은 사전 승인으로 막고, 외부 추적 요청을 만들지 않는다        |
| 블로그 연동 | 글 상세 본문 뒤에 `<comentario-comments>` 를 둔다. 스크립트는 댓글 영역이 화면에 가까워질 때 붙인다 | 첫 화면 로딩에 외부 스크립트를 넣지 않는다                                                      |

## 수용 기준

### 블로그 연동

- **AC-1** `commentsEmbed(slug)` 는 스크립트 주소 `https://comments.gze1206.net/comentario.js`, 고정한 버전의 SRI 해시(`sha384-…`), 페이지 id `postPath(slug)`, 언어 `ko` 를 돌려준다. 페이지 id 를 명시해 `/blog/x` 와 `/blog/x/` 가 같은 댓글을 본다.
- **AC-2** `commentsTheme(isDark)` 는 다크면 `dark`, 아니면 `light` 다.
- **AC-3** 글 상세 페이지는 본문 뒤에 제목 "댓글" 이 붙은 영역과 `<comentario-comments>`(`page-id`, `lang="ko"`, `theme`)를 둔다. 댓글 스크립트는 처음에는 없고, 영역이 화면에 가까워지면 `integrity` 와 `crossorigin="anonymous"` 를 붙여 한 번만 넣는다. 서버나 그 앞단이 스크립트를 바꾸면 브라우저가 실행하지 않는다.
- **AC-4** 사이트 테마를 바꾸면 `<comentario-comments>` 의 `theme` 속성이 따라 바뀐다.
- **AC-5** 글 상세가 아닌 페이지(홈 등)에는 댓글 영역이 없다.

### 운영

- **AC-6** (manual) 컨테이너는 digest 로 고정한 linux/arm64 이미지를 쓰고, 공개 포트 없이 `edge` 네트워크의 alias `comentario` 로만 닿는다. root 가 아닌 UID, 읽기 전용 루트 파일 시스템, `cap_drop: ALL`, `no-new-privileges` 로 돈다.
- **AC-7** (manual) `sites/comments.caddy` 는 `import cloudflare_origin` 으로 시작하고 요청 본문을 1MB 로 제한한다. Cloudflare 는 `comments` 레코드를 프록시한다.
- **AC-8** (manual) 첫 계정(superuser)은 edge 에 붙이기 전에 루프백에서 만든다. 그 뒤 새 가입(`auth.signup.enabled`)과 Gravatar 를 끈다. 도메인 `gze1206.net` 은 익명 허용, 이름 필수, 익명 사전 승인, 로컬 가입 끔, 이미지 마크다운 끔이다.
- **AC-9** (manual) SQLite 를 매일 백업하고 14개까지 둔다.
- **AC-10** `checkDomains` 는 `services` 로 받은 URL(예: 댓글 스크립트)이 200 인지, `integrity` 가 있으면 본문의 sha384 가 같은지 확인한다. `pnpm check:domains` 가 댓글 서버와 블로그에 고정한 해시를 함께 본다. 서버를 갱신하면 해시도 함께 바꿔야 한다.
