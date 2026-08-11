# Blog v4 릴리스 전환 체크리스트

> 작성일: 2026-08-09 · 최종 로컬 갱신: 2026-08-12 · 범위: 로컬 구현 완료 후 외부 공개 작업 인수

## 현재 상태

`v4` 브랜치는 정적 자산으로 빌드된다. 공개 사이트에는 작성 UI나 동적 작성 API가 없으며, 작성과
비공개 보관, 공개용 변환은 private Tailnet 워크벤치가 담당한다. 아래 로컬 검증을 통과했지만,
Cloudflare·DNS·Google·Waline 조작은 아직 실행하지 않았다. 현재 운영 중인 `master` 블로그와
도메인/DNS에는 이 작업으로 변경을 가하지 않았다.

- `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm format:check` 통과
- 생성 HTML의 내부 링크, `404.html`, RSS, 사이트맵 XML, draft 제외 확인
- 홈의 정적 About·기술 스택·포트폴리오·새 글·OG 이미지·다크 모드와 CSS 장식 레이어 확인
- 고정 포트의 로컬 preview에서 `/`, `/topics/`, `/blog/`, `/blog/hello-world/`, `/rss.xml`,
  `/sitemap-index.xml`, `/robots.txt`가 200으로 응답하는지 확인

### 알려진 비차단 항목

- Vite가 500KB 초과 Mermaid 청크 경고를 낸다.
- `pnpm peers check`는 `eslint-plugin-jsx-a11y@6.10.2`가 ESLint 10을 아직 피어 범위에
  포함하지 않는다고 보고한다. 실제 `pnpm lint`는 통과한다.

## 외부 작업 순서

공개 URL을 바꾸는 작업은 반드시 다음 순서로 한다. 각 단계가 확인되기 전에는 다음 단계로 진행하지
않는다.

### 1. NOR-6 — GitHub → Cloudflare 정적 배포

1. Cloudflare Pages 또는 Workers Static Assets에서 `gze1206/blog.gze1206.net` 저장소와 `v4` 브랜치를
   연결한다. `master`는 현재 운영 중인 Nuxt 사이트이므로 이 단계에서 연결하지 않는다.
2. Build command는 `pnpm build`로 설정한다. CLI 배포가 필요하면 정적 산출물에 대해
   `pnpm exec wrangler deploy --config wrangler.jsonc`를 실행한다.
3. 처음에는 제공 URL에서 공개 경로를 확인한다. `v4 → master` 병합은 전체 전환 승인 뒤에만 수행한다.

참고: [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/),
[Cloudflare Workers Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/).

### 2. NOR-7 — 정식 도메인·리다이렉트

1. Custom Domain에 `gze1206.net`을 연결해 HTTPS 발급까지 기다린다.
2. 정본은 `https://gze1206.net`으로 유지한다. canonical·RSS·사이트맵은 이미 이 호스트를 사용한다.
3. Zone-level Redirect Rule(또는 Bulk Redirect)을 **301 + path/query 보존**으로 만든다.
   - `www.gze1206.net/*` → `https://gze1206.net/:splat`
   - `blog.gze1206.net/*` → `https://gze1206.net/:splat`
4. 두 이전 호스트는 Cloudflare 프록시 DNS 레코드가 있어야 Redirect Rule이 적용된다. `/blog/<slug>`
   경로는 이관되어 있으므로 path를 보존한다.
5. 정적 Assets 규칙 또는 Zone Redirect Rule은 동일 호스트의 경로 리다이렉트에만 쓰고, 호스트 간
   정규화에는 Zone Redirect Rule을 쓴다.

참고: [Worker custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[Cloudflare Redirect Rules](https://developers.cloudflare.com/rules/url-forwarding/).

### 3. NOR-32 — Waline 댓글

Waline 서버와 데이터베이스는 블로그 정적 사이트와 분리한다. 서버는 Waline이 공식 지원하는 Vercel,
Netlify, Railway 또는 자가 호스팅 중 하나를 선택한 뒤, 별도 도메인·스팸 방지·백업·알림 정책을
확정한다. 서버 URL과 공개 클라이언트 설정이 준비되기 전에는 댓글 아일랜드를 배포하지 않는다.

- DB 비밀값과 Waline 관리자 비밀값은 서비스의 암호화된 환경 변수로만 보관한다.
- 한국어 UI, 다크 테마 동기화, 익명 댓글의 스팸 방지와 신고/삭제 운영 절차를 실제 서버에서 검증한다.
- 댓글 서버가 안정화된 후에만 글 상세 페이지에 지연 로드 임베드를 추가한다.

참고: [Waline 배포 안내](https://waline.js.org/en/guide/deploy/).

### 4. NOR-33·NOR-34 — 분석과 실사용자 성능

Cloudflare Web Analytics를 정적 배포에 연결한다. 별도 토큰을 저장소에 넣지 않는 방식을 우선하고,
데이터가 쌓인 뒤 LCP·CLS·INP를 다시 판정한다.

- 프로덕션 페이지에서 beacon 1개만 로드되는지 확인한다.
- 최소 28일의 실제 사용자 데이터를 본 뒤 Core Web Vitals를 확정한다.
- 현재의 로컬 Lighthouse/axe 결과는 실사용자 지표를 대체하지 않는다.

참고: [Cloudflare Web Analytics 시작](https://developers.cloudflare.com/web-analytics/get-started/),
[성능·접근성 감사 기록](./spec/NOR-34-performance-a11y-audit.md).

### 5. NOR-36 — 프로덕션 QA와 GSC

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

## 소유자 외부 조치

이 변경은 외부 상태를 수정하지 않는다. 소유자는 공개 CMS에 사용했던 Cloudflare 환경 변수·비밀값,
GitHub App 설치, Access 정책을 검토해 폐기하거나 제거해야 한다. private Tailnet 워크벤치의 자격 증명은
공개 블로그 배포 설정과 분리해 관리한다.

## Linear 상태 원칙

- 외부 설정을 마치고 배포 URL·응답·스크린샷·대시보드 결과를 해당 티켓에 댓글로 남긴 뒤에만 Done으로
  옮긴다.
- 이 문서 작성만으로 NOR-6·7·32·33·34·36을 완료 처리하지 않는다.
