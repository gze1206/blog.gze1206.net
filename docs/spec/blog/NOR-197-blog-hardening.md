# NOR-197 — 블로그 체계적 개선 (하위 프로젝트 2)

- 상위 설계: [../../superpowers/specs/2026-11-12-monorepo-foundation-design.md](../../superpowers/specs/2026-11-12-monorepo-foundation-design.md) "하위 프로젝트" 2번
- 계획: [../../superpowers/plans/2026-11-13-blog-hardening.md](../../superpowers/plans/2026-11-13-blog-hardening.md)

## 결정

| 항목         | 결정                                                                                                                                            | 이유                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| smoke 페이지 | 개발 서버와 `BLOG_SMOKE=1` 빌드에서만 만든다. 프로덕션 빌드에는 `/smoke/*` 가 없다                                                              | draft 글 8편이 noindex 로만 가려진 채 공개 산출물에 나가고 있다. 렌더링 검증(e2e, 수동 확인)은 `BLOG_SMOKE=1` 빌드로 한다                             |
| `/career`    | Astro `redirects` 대신 `public/_redirects` 의 301                                                                                               | Astro 는 `<html>` 없는 meta refresh 페이지를 만들고, 그 페이지가 pagefind 경고를 낸다. Cloudflare Pages 는 `_redirects` 를 HTTP 리다이렉트로 처리한다 |
| Mermaid 청크 | 청크를 쪼개지 않는다. Mermaid 가 없는 페이지가 Mermaid 청크를 참조하지 않음을 빌드 검사로 지키고, `chunkSizeWarningLimit` 을 근거와 함께 올린다 | Mermaid 는 이미 블록이 있을 때만 동적 import 한다. 큰 청크(`@mermaid-js/parser`)는 그 페이지에서만 받는다                                             |
| KaTeX CSS    | 수식 컴포넌트에서만 import 한다                                                                                                                 | 지금은 `BaseLayout` 이 모든 페이지에 KaTeX CSS 와 글꼴 정의를 싣는다                                                                                  |
| 엄격 TS      | 블로그에 `noUncheckedIndexedAccess`·`exactOptionalPropertyTypes` 를 켠다. TS 6 에서 폐기된 `baseUrl` 을 없앤다                                  | 설계 §3 의 "전환 단계에서만 끈다" 를 끝낸다. 측정한 오류는 `tsc` 3건이다                                                                              |
| 의존성       | Vitest 5.1.x, pnpm 12.18.x 로 올린다                                                                                                            | 1a 에서 이 하위 프로젝트로 미뤘다. 둘 다 정식 버전이고 게시된 지 하루가 넘었다                                                                        |

## 수용 기준

### draft·smoke

- **AC-1** `BLOG_SMOKE` 없이 만든 프로덕션 빌드의 `dist/` 에는 `smoke/` 디렉터리가 없고, 어떤 HTML 에도 draft 글의 본문·제목·slug 가 없다.
- **AC-2** `BLOG_SMOKE=1` 빌드와 개발 서버에서는 `/smoke/*` 6쪽이 지금처럼 렌더링되고 `noindex, nofollow` 다. 각 smoke 페이지에 `main#main-content` 가 있다.
- **AC-3** 글 목록·RSS·sitemap·검색 색인의 draft 필터는 `selectVisible` 한 곳뿐이다(`feed.ts` 의 중복 필터를 없앤다).

### 빌드 경고와 메타

- **AC-4** 프로덕션 빌드 로그에 다음 경고가 없다: 500 kB 청크 경고, `og-image-audit` 누락, pagefind 의 `<html>` 없음, Markdoc `plaintext` 언어 경고.
- **AC-5** `/about`, `/books`, `/portfolio` 의 `og:image` 가 실제로 만들어진 이미지를 가리킨다.
- **AC-6** `/career` 는 `public/_redirects` 의 `301` 로 `/about` 에 간다. `dist/career/` 는 없다.
- **AC-7** Mermaid 블록이 없는 페이지의 HTML 은 Mermaid 청크(`mermaid`, `@mermaid-js/parser`, `cytoscape`)와 KaTeX CSS 를 참조하지 않는다. 수식이 있는 페이지는 KaTeX CSS 를 참조한다.

### 코드 정리

- **AC-8** 블로그 `tsconfig.json` 이 `noUncheckedIndexedAccess`·`exactOptionalPropertyTypes` 를 켜고 `baseUrl` 이 없으며, `pnpm --filter @gze1206/blog typecheck`(astro check)와 `tsc --noEmit` 이 오류 0이다. `coverage/` 는 검사 대상이 아니다.
- **AC-9** `src/lib` 에 다른 파일(테스트 제외)이 import 하지 않는 export 가 없다. 이를 `repo-tools` 의 검사(`pnpm dead-exports`)가 지킨다. `legacy-post-migration.ts` 와 `findPostBySlug` 를 지운다.
- **AC-10** `topics.astro` 의 분류 목록 생성, `portfolio.astro` 의 컬렉션 조회·정렬, `books.astro` 의 상태·형식 라벨이 `src/lib` 의 테스트된 함수로 옮겨진다.

### e2e

- **AC-11** e2e 가 다음을 덮는다: 시리즈 목록·상세, 태그 목록·상세, 카테고리 목록·상세, `/topics`, `/about`, `/portfolio`, `/blog/2` 페이지네이션(글이 한 쪽을 넘지 않으면 `/blog/2` 가 404), 404 본문, RSS 응답 형식, 검색 팔레트(⌘K/Ctrl+K 로 열고 검색어로 공개 글을 찾음), 테마 토글 유지.
- **AC-12** `BLOG_SMOKE=1` e2e 가 Mermaid 블록을 SVG 로 렌더링하고, 수식이 KaTeX 로 렌더링됨을 확인한다.

### 의존성

- **AC-13** (manual) Vitest 5.1.x 와 pnpm 12.18.x 에서 `pnpm verify`·`pnpm e2e`·`pnpm tdd:evidence --base v4` 가 통과하고, CI·Dockerfile·Cloudflare Pages 빌드가 같은 pnpm 버전을 쓴다.
- **AC-14** (manual) `docs/release-readiness.md` 의 낡은 서술(draft 확인 경로, Mermaid 경고)을 현재 상태로 고친다.
