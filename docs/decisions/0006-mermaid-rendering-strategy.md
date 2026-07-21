---
number: '0006'
title: Mermaid 다이어그램 렌더링 전략 — 클라이언트 아일랜드
status: accepted
date: 2026-07-21
related: [NOR-13]
---

# 0006. Mermaid 다이어그램 렌더링 전략 — 클라이언트 아일랜드

## 맥락 (Context)

NOR-13에서 Mermaid 다이어그램 렌더링을 구현해야 한다. 블로그의 핵심 원칙은 "정적 우선·점진적 향상"이며, CLS(Cumulative Layout Shift) 최소화가 요구된다.

## 검토한 대안 (Options)

- **A안: 빌드타임 렌더 (rehype-mermaid)** — `rehype-mermaid` → `mermaid-isomorphic` → Playwright. 빌드 시 SVG로 변환하여 순수 정적 HTML 출력. 장점: JS 없이 렌더, CLS 0. 단점: Playwright 의존(~200MB+), 빌드 속도 저하, CI 환경에서 headless browser 설치 필요, Cloudflare Pages 빌드 환경 제약.
- **B안: 클라이언트 아일랜드 (client:visible)** — Mermaid JS를 아일랜드로 격리, 뷰포트 진입 시 렌더. 장점: 빌드 의존성 최소, CI 제약 없음, 다크모드 런타임 전환 용이. 단점: JS 필요, CLS 가능성(자리 예약으로 완화).

## 결정 (Decision)

**B안 — 클라이언트 아일랜드(client:visible)** 를 채택한다.

## 근거 (Rationale)

- Playwright는 빌드 의존성 ~200MB+로 개인 블로그에 과도하며, Cloudflare Pages 빌드 환경에서 headless browser 설치가 추가 설정을 요구한다.
- 다이어그램은 보조 시각 자료로, 수식과 달리 텍스트 폴백이 의미를 충분히 전달한다(점진적 향상 원칙 충족).
- CLS는 Mermaid 컨테이너에 min-height 자리 예약으로 완화한다.
- 런타임 다크모드 전환 시 Mermaid 테마도 즉시 반영 가능(빌드타임은 두 벌 생성 필요).
- `prefers-reduced-motion` 존중을 런타임에서 자연스럽게 처리할 수 있다.

## 영향 (Consequences)

- 긍정: 빌드 속도 유지, CI 설정 단순, 다크모드 전환 자연스러움.
- 부정/비용: JS 비활성화 시 원문 코드 표시(폴백), 약간의 CLS 가능성.
- 후속 작업: Mermaid 번들 크기 최적화(dynamic import), CLS 모니터링.
