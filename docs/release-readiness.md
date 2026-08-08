# Blog v4 릴리스 전환 체크리스트

> 작성일: 2026-08-09 · 범위: 로컬 구현 완료 후 외부 공개 작업 인수

## 현재 상태

`v4` 브랜치의 정적 산출물은 배포 가능한 상태다. 아래 로컬 검증을 통과했지만, 이 문서의
Cloudflare·GitHub·Google·Waline 조작은 아직 실행하지 않았다. 현재 운영 중인 `master` 블로그와
도메인/DNS에는 이 작업으로 변경을 가하지 않았다.

- `pnpm test` — 29 파일, 307 테스트 통과
- `pnpm lint`, `pnpm build`, `pnpm format:check` 통과
- 생성된 64개 HTML의 내부 링크, `404.html`, RSS, 사이트맵 XML, draft 제외 확인
- 홈의 정적 About·새 글·OG 이미지·다크 모드·장식 캔버스의 `aria-hidden` 확인
- `three`(724,461 bytes)는 `InteractiveCanvas`의 동적 import 청크이며, 홈 HTML 초기 아일랜드
  엔트리에는 포함되지 않는다.

### 알려진 비차단 항목

- Vite가 500KB 초과 청크 경고를 낸다. Mermaid의 기존 청크와 Three.js 청크가 대상이다. Three.js는
  `client:visible` 이후 지원되는 데스크톱에서만 로드된다.
- `pnpm peers check`는 `eslint-plugin-jsx-a11y@6.10.2`가 ESLint 10을 아직 피어 범위에
  포함하지 않는다고 보고한다. 실제 `pnpm lint`는 통과한다. 의존성을 억지로 내리거나 제거하지 말고,
  플러그인 업데이트 시 재확인한다.

## 외부 작업 순서

공개 URL을 바꾸는 작업은 반드시 다음 순서로 한다. 각 단계가 확인되기 전에는 다음 단계로 진행하지
않는다.

### 1. NOR-6 — GitHub → Cloudflare Pages

1. Cloudflare Workers & Pages에서 새 Pages 프로젝트를 만들고
   `gze1206/blog.gze1206.net` 저장소를 GitHub 연동한다.
2. 처음에는 `v4`를 production branch로 지정해 `*.pages.dev`에서 새 빌드를 확인한다. `master`는
   현재 운영 중인 Nuxt 사이트이므로, 이 단계에서 production branch로 지정하지 않는다.
3. Build command는 `pnpm build`, Build output directory는 `dist`로 설정한다.
4. Pages Build System v3에서는 `package.json`의 `engines`를 자동 감지하지 않으므로,
   `NODE_VERSION=22.12.0` 이상을 명시한다. pnpm lockfile을 인식하는지 빌드 로그에서 확인한다.
5. `v4` preview에서 이 문서의 로컬 QA 항목을 다시 확인한다. 전환 승인 후 `v4 → master`를 병합하고
   production branch를 `master`로 바꾼다.

참고: [Cloudflare Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/),
[Cloudflare build image](https://developers.cloudflare.com/pages/configuration/build-image/).

### 2. NOR-7 — 정식 도메인·리다이렉트

1. Pages 프로젝트의 Custom domains에 `gze1206.net`을 연결해 HTTPS 발급까지 기다린다.
2. 정본은 `https://gze1206.net`으로 유지한다. canonical·RSS·사이트맵은 이미 이 호스트를 사용한다.
3. Zone-level Redirect Rule(또는 Bulk Redirect)을 **301 + path/query 보존**으로 만든다.
   - `www.gze1206.net/*` → `https://gze1206.net/:splat`
   - `blog.gze1206.net/*` → `https://gze1206.net/:splat`
4. 두 이전 호스트는 Cloudflare 프록시 DNS 레코드가 있어야 Redirect Rule이 적용된다. `/blog/<slug>`
   경로는 이관되어 있으므로 path를 보존한다.
5. Pages의 `_redirects` 파일은 동일 호스트의 경로 리다이렉트용이다. 호스트 간 정규화에는 사용하지
   않는다.

참고: [Pages custom-domain redirect](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/),
[Cloudflare Redirect Rules](https://developers.cloudflare.com/rules/url-forwarding/),
[Pages `_redirects`](https://developers.cloudflare.com/pages/configuration/redirects/).

### 3. NOR-20 — Keystatic GitHub 웹 편집

현재 Keystatic은 의도적으로 `local` storage와 개발 서버 전용 `/keystatic`을 쓴다. 정적 Pages에
GitHub 모드를 노출하려면 먼저 Node 호환 API route를 제공할 배포 구조를 확정해야 한다. 그 뒤에만
`storage.kind`를 `github`으로 바꾸고 GitHub App을 생성한다.

- `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`,
  `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`는 Cloudflare의 암호화된 환경 변수로만 등록한다.
- GitHub App은 이 저장소에만 write 권한을 주고, callback URL은 실제 공개 `/keystatic` 주소로
  제한한다.
- 현재의 완전 정적 Pages 사이트에 비밀값이나 공개 API route를 임의로 추가하지 않는다.

참고: [Keystatic GitHub mode](https://keystatic.com/docs/github-mode),
[ADR 0012](./decisions/0012-keystatic-integration-strategy.md).

### 4. NOR-32 — Waline 댓글

Waline 서버와 데이터베이스는 블로그 정적 사이트와 분리한다. 서버는 Waline이 공식 지원하는 Vercel,
Netlify, Railway 또는 자가 호스팅 중 하나를 선택한 뒤, 별도 도메인·스팸 방지·백업·알림 정책을
확정한다. 서버 URL과 공개 클라이언트 설정이 준비되기 전에는 댓글 아일랜드를 배포하지 않는다.

- DB 비밀값과 Waline 관리자 비밀값은 서비스의 암호화된 환경 변수로만 보관한다.
- 한국어 UI, 다크 테마 동기화, 익명 댓글의 스팸 방지와 신고/삭제 운영 절차를 실제 서버에서 검증한다.
- 댓글 서버가 안정화된 후에만 글 상세 페이지에 지연 로드 임베드를 추가한다.

참고: [Waline 배포 안내](https://waline.js.org/en/guide/deploy/).

### 5. NOR-33·NOR-34 — 분석과 실사용자 성능

Cloudflare Pages 프로젝트의 Metrics에서 Web Analytics를 Enable한다. Pages에서는 다음 배포부터
beacon을 자동 삽입할 수 있으므로, 별도 토큰을 저장소에 넣지 않는 방식을 우선한다. 데이터가 쌓인 뒤
LCP·CLS·INP를 다시 판정한다.

- 프로덕션 페이지에서 beacon 1개만 로드되는지 확인한다.
- 최소 28일의 실제 사용자 데이터를 본 뒤 Core Web Vitals를 확정한다.
- 현재의 로컬 Lighthouse/axe 결과는 실사용자 지표를 대체하지 않는다.

참고: [Cloudflare Web Analytics 시작](https://developers.cloudflare.com/web-analytics/get-started/),
[성능·접근성 감사 기록](./spec/NOR-34-performance-a11y-audit.md).

### 6. NOR-36 — 프로덕션 QA와 GSC

정식 도메인 배포 후 아래 주소를 실제 HTTPS 응답으로 확인한다.

- `/`, `/blog`, `/blog/hello-world`, `/topics`, 존재하지 않는 경로(404)
- `/rss.xml`, `/sitemap-index.xml`, `/robots.txt`, `/og/blog/hello-world.png`
- `www`와 `blog` 이전 호스트의 301 상태·path/query 보존·정본 canonical
- 데스크톱/모바일, 라이트/다크, 키보드 탐색, 페이지 내 검색

그 다음 Google Search Console에 Domain property `gze1206.net`을 추가해 DNS로 소유권을 확인하고,
`https://gze1206.net/sitemap-index.xml`을 제출한다. 첫 글은 URL Inspection으로 수집 가능 여부를
확인한다.

참고: [Search Console Domain property](https://support.google.com/webmasters/answer/34592),
[sitemap 제출](https://support.google.com/webmasters/answer/7451001).

## Linear 상태 원칙

- 외부 설정을 마치고 위 검증 증거(배포 URL·응답·스크린샷·대시보드 결과)를 해당 티켓에 댓글로 남긴
  뒤에만 Done으로 옮긴다.
- 이 문서 작성만으로 NOR-6·7·20·32·33·34·36을 완료 처리하지 않는다.
