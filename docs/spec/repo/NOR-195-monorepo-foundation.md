# NOR-195 — 모노레포 기반 (하위 프로젝트 1a)

- 설계: [../../superpowers/specs/2026-11-12-monorepo-foundation-design.md](../../superpowers/specs/2026-11-12-monorepo-foundation-design.md)
- 계획: [../../superpowers/plans/2026-11-12-monorepo-foundation-1a.md](../../superpowers/plans/2026-11-12-monorepo-foundation-1a.md)

## 수용 기준

- **AC-1** 경계 검사기는 패키지 디렉터리를 벗어나는 상대 import 와 `apps/*` 패키지 이름 import 를 위반으로 보고하고, 패키지 안의 상대 import 와 `packages/*` 이름 import 는 허용한다.
- **AC-2** `spec:check` 는 수용 기준(AC) 중 어떤 테스트 이름에도 `NOR-N AC-n` 으로 연결되지 않은 것을 보고한다. `(manual)` 표시가 있는 AC 는 제외한다.
- **AC-3** `tdd-evidence` 는 `TDD: red` 커밋이 바꾼 테스트가 단언 실패나 모듈 없음으로 실패하면 red 로 인정하고, 통과하거나 문법·변환 오류로 실패하면 거부한다. 이어지는 `TDD: green` 커밋에서 같은 테스트가 통과해야 한다.
- **AC-4** `postSchema` 는 `toc` 로 `auto`·`inline`·`floating`·`false` 만 받고 기본값은 `auto` 다. series 와 seriesOrder 는 함께 있어야 한다. 빈 문자열 제목과 대문자 slug 를 거부한다. `strictPostSchema` 는 같은 규칙에 더해 모르는 키를 거부한다. `POST_FIELD_ORDER` 는 스키마의 모든 키를 정확히 한 번씩 담는다.
- **AC-5** 블로그의 `postSchema`·`seriesSchema` 는 `@gze1206/content-contract` 의 것과 같은 객체다.
- **AC-6** 워크벤치는 초안의 `toc` 를 발행 결과에 남기고, 초안에 `toc` 가 없으면 발행 결과에도 쓰지 않는다.
- **AC-7** 워크벤치의 발행 경로와 기본 대상 브랜치는 `BLOG_LAYOUT` 에서 온다. `BLOG_LAYOUT` 의 경로는 실제 블로그 디렉터리를 가리킨다.
- **AC-8** 워크벤치 변환 결과를 블로그 `postSchema` 로 다시 읽으면 같은 값이다.
- **AC-9** 블로그의 모든 글 frontmatter 가 `strictPostSchema` 를 통과한다.
- **AC-10** (manual) 블로그 `dist/` 가 이동 전·계약 적용 후에 기준선과 바이트 단위로 같다.
- **AC-11** (manual) 워크벤치 linux/arm64 이미지가 부팅하고 `/api/health` 가 `{"status":"ready"}` 를 돌려준다.
- **AC-12** (manual) PR 에서 `ci.yml` 의 `verify`·`e2e`·`spec-check`·`tdd-evidence` 가 실행되어 통과한다.
