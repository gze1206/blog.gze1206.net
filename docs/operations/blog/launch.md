# 블로그 런칭: v4 → main, 정식 도메인 (NOR-199)

새 블로그(v4)를 `main` 으로 올리고 정본 호스트 `https://gze1206.net` 에 연결하는 절차다. 결정과 수용
기준은 [NOR-199 명세](../../spec/blog/NOR-199-blog-launch.md) 에 있다. 각 단계가 확인되기 전에는 다음
단계로 넘어가지 않는다.

## 런칭 전 상태

| 호스트             | 지금                                        | 런칭 뒤                          |
| ------------------ | ------------------------------------------- | -------------------------------- |
| `gze1206.net`      | Cloudflare 프록시, 원본 인증서 오류(526)    | Pages 프로덕션(`main`)           |
| `www.gze1206.net`  | Cloudflare 프록시, 526                      | 정본으로 301(경로·쿼리 보존)     |
| `blog.gze1206.net` | Cloudflare 프록시 → 옛 Netlify 사이트(Nuxt) | 정본으로 301(경로·쿼리 보존)     |
| `*.pages.dev`      | v4 프로덕션                                 | `main` 프로덕션, 그 밖은 preview |

옛 사이트 sitemap 의 경로(`packages/repo-tools/src/domains/legacy-paths.txt`)는 새 사이트에도 같은
경로로 있다. 그래서 호스트만 바꾸고 경로 리다이렉트는 두지 않는다.

## 1. v4 를 main 으로 올린다

1. 옛 사이트를 태그로 남긴다: `git tag -a legacy-nuxt -m "v4 런칭 전 옛 사이트" origin/main` 후 push.
2. `v4 → main` PR 을 만들고 필수 check 가 모두 통과하면 merge commit 으로 병합한다.
3. 이후 일감 PR 의 base 는 `main` 이다. `v4` 는 런칭 확인이 끝나면 지운다(ruleset 대상에서도 뺀다).

## 2. Pages 프로덕션 브랜치를 main 으로 바꾼다

Cloudflare 대시보드 → Workers & Pages → `blog-gze1206-net` → Settings → Builds & deployments →
Production branch 를 `main` 으로 바꾼다. 빌드 루트(`apps/blog`)와 명령은 그대로다.

- 확인: `main` 의 프로덕션 배포가 성공하고 `*.pages.dev` 의 `/about/` 이 200 이다.
- 이 설정이 바뀌어야 `smoke-gate` 의 프로덕션 판정(`CF_PAGES_BRANCH === 'main'`)과 실제 배포가 맞는다.

## 3. 정본 도메인을 연결한다

1. DNS 에서 `gze1206.net`(apex)의 기존 A/AAAA/CNAME 레코드를 지운다. 지금 526 을 내는 레코드다.
2. Pages 프로젝트 → Custom domains → `gze1206.net` 을 추가한다. 같은 계정의 zone 이므로 Cloudflare 가
   프록시 CNAME 을 만들고 인증서를 발급한다. 상태가 Active 가 될 때까지 기다린다.

## 4. 이전 호스트를 정본으로 보낸다

1. `www`·`blog` 레코드는 **프록시(주황 구름)** 로 남긴다. 리다이렉트 규칙은 프록시된 요청에만 적용된다.
   원본으로 갈 일이 없으므로 대상은 `100::`(AAAA, 프록시)로 바꿔 Netlify 의존을 끊는다.
2. Rules → Redirect Rules → Single Redirect 를 하나 만든다.
   - 조건(식): `(http.host in {"www.gze1206.net" "blog.gze1206.net"})`
   - 대상: Dynamic, `concat("https://gze1206.net", http.request.uri.path)`
   - 상태 코드 `301`, **Preserve query string** 켬

## 5. 확인한다

```sh
pnpm check:domains
```

실패가 0 이어야 한다. 정본 200·canonical, 두 이전 호스트의 경로·쿼리 보존 301, 옛 경로 200 을 본다.
네트워크를 쓰므로 `verify`·CI 에는 들어 있지 않다. 도메인 설정을 바꿀 때마다 다시 돌린다.

## 6. 뒤처리

- 워크벤치 호스트의 `.env` 에 `PUBLIC_BLOG_BRANCH=main` 을 두고 컨테이너를 다시 띄운다
  ([../workbench/oci.md](../workbench/oci.md) "이미지 갱신" 의 명령).
- 워크벤치 이미지 워크플로는 이제 `main` push 로 돈다. 태그 게시는 필요할 때만 한다.
- Netlify 의 옛 사이트를 지운다(배포 연결 해제 → 사이트 삭제).
- 검색 엔진에 `https://gze1206.net/sitemap-index.xml` 을 제출한다.

## 되돌리기

- 도메인: Redirect Rule 을 끄고, Pages Custom domain 에서 `gze1206.net` 을 뗀다. `blog` 레코드를 Netlify
  대상으로 되돌리면 옛 사이트가 다시 보인다(Netlify 를 지우기 전까지만 가능하다).
- 코드: `main` 을 되돌릴 때는 `legacy-nuxt` 태그에서 브랜치를 만들어 PR 로 되돌린다. 강제 push 는 하지
  않는다(ruleset 이 막는다).
