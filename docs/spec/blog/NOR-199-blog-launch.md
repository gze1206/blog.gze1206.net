# NOR-199 — 블로그 공개 배포와 도메인 (하위 프로젝트 4)

- 상위 설계: [../../superpowers/specs/2026-11-12-monorepo-foundation-design.md](../../superpowers/specs/2026-11-12-monorepo-foundation-design.md) "하위 프로젝트" 4번
- 이어받는 일감: NOR-6(정적 배포), NOR-7(정식 도메인·리다이렉트)
- 런칭 절차: [../../operations/blog/launch.md](../../operations/blog/launch.md)

## 결정

| 항목            | 결정                                                                                                                 | 이유                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 배포처          | Cloudflare Pages(지금 쓰는 `blog-gze1206-net` 프로젝트, 빌드 루트 `apps/blog`)                                       | 블로그는 정적 산출물뿐이다. OCI 는 다른 프로젝트와 함께 쓰는 1vCPU 호스트라 정적 사이트를 둘 이유가 없고, 이미 v4 를 Pages 가 배포하고 있다 |
| `publishBranch` | `main`                                                                                                               | 런칭 때 v4 를 main 에 병합하고 main 을 Pages 의 프로덕션 브랜치로 둔다. 워크벤치 발행도 main 으로 간다                                      |
| 정본 호스트     | `https://gze1206.net`                                                                                                | canonical·RSS·사이트맵이 이미 이 호스트를 쓴다(NOR-30)                                                                                      |
| 호스트 정규화   | `www.gze1206.net`·`blog.gze1206.net` 은 Zone 의 Single Redirect Rule 로 정본 호스트에 301 한다. 경로·쿼리를 보존한다 | 호스트 간 정규화는 Pages `_redirects` 로 할 수 없다. Functions 를 두지 않고 정적 배포를 유지한다                                            |
| 런칭 확인       | `pnpm check:domains` 가 정본 200, 이전 호스트 301, 경로 보존, canonical 일치를 확인한다                              | 손으로 curl 을 반복하지 않고 같은 기준으로 런칭 직후와 이후 회귀를 확인한다                                                                 |

## 수용 기준

### 브랜치

- **AC-1** `BLOG_LAYOUT.publishBranch` 는 `'main'` 이다.
- **AC-2** Cloudflare Pages 빌드(`CF_PAGES=1`)는 브랜치와 무관하게 `BLOG_SMOKE=1` 을 거부한다. preview(`*.pages.dev`)도 공개 주소이고, smoke 빌드는 로컬 e2e 에서만 쓴다. (런칭 뒤 보안 검수로 갱신: 처음에는 `publishBranch` 배포만 막았다. 그러면 Production branch 설정이 틀리거나 preview 에서 smoke 가 공개될 수 있었다.)
- **AC-3** 워크벤치 compose 의 `PUBLIC_BLOG_BRANCH` 기본값과 `.env.example` 은 `main` 이다. e2e fixture 는 `BLOG_LAYOUT.publishBranch` 를 쓴다.

### 도메인 확인

- **AC-4** `checkDomains(fetch)` 는 정본 `https://gze1206.net/` 이 200 이고 `<link rel="canonical">` 이 정본 호스트를 가리키는지 확인한다.
- **AC-5** `checkDomains` 는 `www.`·`blog.` 호스트에서 확인 경로(`probes`, 루트 `/` 와 경로·쿼리가 붙은 글 주소)마다 301 로 같은 경로·쿼리의 정본 URL 에 가는지 확인한다. 302, 다른 경로, 다른 호스트는 실패다.
- **AC-6** `checkDomains` 는 옛 사이트 sitemap 에 있던 경로(`/blog/<slug>/` 등, `legacy-paths.txt`)가 정본 호스트에서 200 인지 확인한다. 옛 사이트와 새 사이트는 글 경로 형식이 같으므로 경로 리다이렉트는 두지 않는다.
- **AC-7** 네트워크 오류와 해석할 수 없는 `Location`·canonical 도 실패 항목으로 남기고 나머지를 계속 확인한다. `pnpm check:domains` 는 실패 항목을 모두 출력하고 하나라도 실패하면 0 이 아닌 코드로 끝난다. 네트워크를 쓰므로 `verify` 와 CI 에는 넣지 않는다.
- **AC-8** `checkDomains` 는 이전 호스트에 악의적인 경로(`hostileProbes`, 예: `//evil.example/x?next=https://evil.example`)를 보내고, 301 의 `Location` 이 정본 origin 에 머무는지 확인한다. 경로 정규화(`//` → `/`)는 Cloudflare 가 하므로 경로 일치는 보지 않는다.
