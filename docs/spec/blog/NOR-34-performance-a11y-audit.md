---
issue: NOR-34
title: 성능(CWV)·접근성 최종 감사
status: in-progress
---

# NOR-34 — 성능(CWV)·접근성 최종 감사

> Linear: https://linear.app/noru-kim/issue/NOR-34

## 목표

배포 전 정적 산출물을 대상으로 성능·접근성·번들 예산을 감사하고, 코드에서 해결 가능한 문제를
수정한다. 실제 사용자 CWV는 배포와 분석 연동 후에만 확정한다.

## 입력 / 출력

- 입력: `pnpm build` 산출물과 로컬 Astro preview
- 출력: 접근성 위반 해소, 번들·이미지 측정 결과, 재현 가능한 검증 기록

## 성공 / 실패 조건

- 성공: 주요 정적 페이지 axe 위반 0건, Lighthouse 접근성·SEO 100점, 로컬 번들·이미지 점검 완료
- 보류: 필드 LCP·CLS·INP는 Cloudflare 배포 및 실제 사용자 데이터가 있어야 판정 가능

## 검증 방법

- [x] `pnpm test` — 36 파일, 322개 테스트 통과 (2026-08-10 병합 후 재검증)
- [x] `pnpm lint`, `pnpm build`, `pnpm format:check` 통과
- [x] Playwright + axe로 `/`, `/topics/`, `/posts/` 위반 0건
- [x] Lighthouse 로컬 감사: 접근성·SEO 100점, 외부 Pretendard CDN 요청 0건
- [x] 산출물의 최대 JS·이미지·웹폰트 크기 점검
- [ ] 배포 후 실제 사용자 CWV(LCP·CLS·INP) 확인

## 구현 계획 (plan)

1. Lighthouse가 발견한 테마 토글의 시각 아이콘·접근성 이름 불일치를 테스트 우선으로 해소한다.
2. Pretendard 동적 서브셋을 프로젝트에서 제공해 제3자 CSS 요청을 제거한다.
3. axe·Lighthouse·산출물 측정을 다시 실행하고, 배포 후 확인 항목을 분리한다.

## 측정 기록 (2026-08-09, 로컬)

- Lighthouse 홈: 성능 88점, 접근성 100점, SEO 100점, LCP 약 3.2초, CLS 0에 근접.
- LCP는 로컬 CPU/네트워크 시뮬레이션의 단일 실행값이다. 표준 "좋음" 기준 2.5초를 충족했다고
  주장하지 않으며, 배포 CDN과 실제 사용자 데이터로 재검증한다.
- Pretendard는 동적 서브셋 9개(홈 기준 약 238KB)만 요청됐고, 외부 CDN 요청은 없었다.
- 최대 정적 이미지: 64KB. Mermaid(약 663KB)와 Cytoscape(약 435KB)는 해당 기능을 사용할 때만
  지연 로드된다. Vite의 Mermaid 500KB 경고는 유지하되 초기 공통 번들로 포함되지 않는 것을 확인했다.
- `pnpm peers check`는 `eslint-plugin-astro@3.0.1`이 요구하는 ESLint 10과,
  `eslint-plugin-jsx-a11y@6.10.2`가 선언한 ESLint 9 이하 peer 범위의 상위 패키지 충돌을 보고한다.
  접근성 린트 규칙을 제거하지 않고, 플러그인 지원 범위가 갱신될 때 재검토한다.

## 병합 후 정합성 확인 (2026-08-10, 로컬)

- NOR-20·NOR-136·NOR-137·NOR-138을 `v4`에 통합한 뒤 전체 테스트 36 파일·322개, lint, format,
  build와 `git diff --check`를 다시 통과했다.
- 고정 포트의 Astro preview에서 `/`, `/topics/`, `/blog/`, `/blog/hello-world/`, `/rss.xml`,
  `/sitemap-index.xml`, `/robots.txt`는 모두 200으로 응답했다.
- `/api/keystatic/tree`는 GitHub App 환경 변수 세 개가 비어 있는 로컬 상태에서 500을 반환한다. 이는
  비밀값 없이 원격 CMS를 작동시키지 않는 의도된 보호 상태이며, Cloudflare Worker 비밀값·Access 설정 뒤
  실기기 검증으로 해소해야 한다.
- Playwright용 Chromium과 Lighthouse CLI는 이 로컬 환경에 설치되어 있지 않아, 2026-08-09의
  브라우저 감사 수치를 재측정하거나 갱신하지 않았다. 실제 사용자 CWV 판정은 여전히 배포 후 항목이다.

## 운영 감사 (2026-11-15, gze1206.net, Lighthouse 12 모바일)

| 페이지                     | 성능 | 접근성 | 권장 | SEO | LCP   | CLS   |
| -------------------------- | ---- | ------ | ---- | --- | ----- | ----- |
| `/`                        | 77   | 100    | 100  | 92  | 2.2 s | 0.008 |
| `/blog/c-9-0-record-type/` | 91   | 96     | 100  | 92  | 2.2 s | 0.009 |
| `/books/`                  | 64   | 100    | 100  | 92  | 5.8 s | 0.004 |
| `/about/`                  | 88   | 100    | 100  | 92  | 2.2 s | 0.012 |

- SEO 92 는 Cloudflare 관리형 robots.txt 블록의 `Content-Signal` 지시어를 Lighthouse 가 모르는 지시어로 보기 때문이다. 저장소 밖(Cloudflare 설정)의 일이라 기록만 한다.
- 홈의 TBT 는 주로 스타일·레이아웃 계산과 Cloudflare 가 주입하는 `/cdn-cgi/` 스크립트다.
- `/books/` 의 LCP 는 첫 표지(약 270KB)이고, 첫 화면 표지까지 지연 로드되어 늦게 요청된다.

### 수용 기준

- **AC-1** 책장의 첫 줄 표지(앞의 6권)는 지연 로드하지 않고, 첫 표지는 `fetchpriority="high"` 로 요청한다. 나머지는 지연 로드한다.
- **AC-2** 목차 링크의 터치 대상은 높이 24px 이상이다(WCAG 2.5.8).
