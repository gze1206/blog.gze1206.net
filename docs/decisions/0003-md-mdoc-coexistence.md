---
number: '0003'
title: posts 컬렉션에서 .md와 .mdoc 병행 지원
status: accepted
date: 2026-07-21
related: [NOR-10]
---

# 0003. posts 컬렉션에서 .md와 .mdoc 병행 지원

## 맥락 (Context)

NOR-10에서 Markdoc 통합을 도입하면서, 기존 `.md` 글(hello-world, draft-example)을 어떻게 처리할지 결정해야 한다. 글로벌 파이프라인 전환이냐, 점진적 전환이냐의 문제.

## 검토한 대안 (Options)

- **A안: .md → .mdoc 전면 전환** — 기존 `.md` 파일을 모두 `.mdoc`으로 변환. glob 패턴을 `.mdoc`만 지원.
  - 장점: 단일 포맷으로 일관성.
  - 단점: 기존 글 깨짐 위험. 표준 Markdown 도구 호환성 저하. 되돌리기 어려움.

- **B안: .md와 .mdoc 병행 지원** — glob 패턴에 `**/*.{md,mdx,mdoc}`을 사용하여 두 형식 공존.
  - 장점: 기존 글 무변경, 점진적 전환 가능, 단순 글은 `.md`로 유지.
  - 단점: 두 형식이 혼재하여 약간의 인지 부하.

## 결정 (Decision)

**B안: .md와 .mdoc 병행 지원**을 선택한다.

## 근거 (Rationale)

- 기존 `.md` 글이 이미 존재하며, 커스텀 태그가 필요 없는 단순 글은 `.md`로 유지하는 것이 자연스럽다.
- Markdoc 커스텀 태그가 필요한 글만 `.mdoc`으로 작성하면 된다.
- Astro의 glob 로더가 여러 확장자를 자연스럽게 지원한다.
- 전면 전환은 되돌리기 어려우므로 점진적 접근이 안전하다.

## 영향 (Consequences)

- 긍정: 기존 콘텐츠 무변경, 점진적 전환 가능, 도구 호환성 유지.
- 부정/비용: 같은 slug의 `.md`와 `.mdoc` 파일이 동시에 존재하면 충돌 가능 — 운영 규칙으로 방지.
- 후속 작업: 콘텐츠 작성 가이드(`content-a11y-seo.md`)에 `.md` vs `.mdoc` 선택 기준 추가 고려.
