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

- [x] `pnpm test` — 293개 테스트 통과
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
