---
number: '0005'
title: 코드블럭 강화 — Shiki Transformer + 인라인 스크립트 전략
status: accepted
date: 2026-07-21
related: [NOR-12]
---

# 0005. 코드블럭 강화 — Shiki Transformer + 인라인 스크립트 전략

## 맥락 (Context)

NOR-12에서 코드블럭에 복사 버튼, 파일명 라벨, 라인 하이라이트, diff 표기를 추가해야 한다. .md(Markdown)와 .mdoc(Markdoc) 양쪽 렌더 경로에서 동작해야 하며, 라이트/다크 듀얼 테마(NOR-11)와 정합해야 한다.

## 검토한 대안 (Options)

- **A안: @shikijs/transformers + 커스텀 transformer** — Shiki의 공식 transformer 패키지(`transformerNotationDiff`, `transformerNotationHighlight`)를 사용하고, 파일명 라벨은 커스텀 transformer로 meta 파싱. 복사 버튼은 인라인 스크립트로 점진적 향상.
  - 장점: Shiki 빌드타임에 처리되어 런타임 JS 최소. 공식 패키지로 유지보수 부담 적음.
  - 단점: Markdoc 경로에서 파일명 라벨이 미지원(Markdoc 파서가 fence meta를 버림).

- **B안: rehype 플러그인** — rehype-pretty-code 등으로 코드블럭 후처리.
  - 장점: 유연한 HTML 조작.
  - 단점: Markdoc 경로에는 적용 불가(rehype는 Markdown 파이프라인 전용). 별도 의존성 추가.

- **C안: Astro 컴포넌트 래퍼** — 코드블럭을 감싸는 Astro 컴포넌트로 모든 기능 구현.
  - 장점: 완전한 제어.
  - 단점: 콘텐츠 작성 시 매번 컴포넌트 태그 사용 필요. 표준 코드펜스 문법 사용 불가.

## 결정 (Decision)

**A안** 채택. `@shikijs/transformers`의 notation 기반 transformer와 커스텀 title transformer를 사용하고, 복사 버튼은 인라인 `<script>`로 구현한다.

## 근거 (Rationale)

- Shiki transformer는 빌드타임에 HAST 트리를 조작하므로 런타임 JS가 최소화되어 정적 우선 원칙에 부합.
- notation 기반 하이라이트/diff(`// [!code highlight]`, `// [!code ++]`)는 코드 내용에 포함되므로 .md/.mdoc 양쪽에서 동작.
- 복사 버튼은 프레임워크 의존 없는 인라인 스크립트로 점진적 향상 — JS 미로드 시에도 코드는 정상 읽힘.
- 파일명 라벨은 Markdown의 meta string(`title="..."`)을 파싱하는 커스텀 transformer로 구현. Markdoc은 파서 수준에서 fence meta를 지원하지 않아 미지원(알려진 제한).

## 영향 (Consequences)

- 긍정: 런타임 JS 최소(복사 버튼 스크립트 ~1KB). 빌드타임 처리로 SSG 성능 무영향. 표준 Shiki notation 사용으로 에코시스템 호환.
- 부정/비용: Markdoc 경로에서 `title="..."` 파일명 라벨 미지원. `shiki`, `@markdoc/markdoc` 직접 의존성 추가(기존에는 Astro 내부 의존).
- 후속 작업: Markdoc이 fence meta를 지원하게 되면 title transformer 적용 가능.
