---
number: "0002"
title: 콘텐츠 스키마를 별도 모듈로 분리
status: accepted
date: 2026-07-20
related: [NOR-9]
---

# 0002. 콘텐츠 스키마를 별도 모듈로 분리

## 맥락 (Context)

NOR-9에서 posts·series·portfolio의 zod 스키마를 정의한다. Astro Content Collections는 `src/content.config.ts`에서 스키마를 인라인으로 정의하는 것이 기본이지만, 스키마 로직에 대한 단위 테스트가 필요하다.

## 검토한 대안 (Options)

- **A안: content.config.ts에 인라인** — 간단하지만 단위 테스트 시 Astro 런타임 의존성이 필요하고, 스키마만 독립 import 불가.
- **B안: src/content/schemas.ts로 분리 후 content.config.ts에서 import** — 스키마 객체를 순수 zod 모듈로 export하여 vitest에서 직접 테스트 가능. content.config.ts는 얇은 등록 레이어로 유지.

## 결정 (Decision)

**B안 채택**: `src/content/schemas.ts`에 zod 스키마를 정의·export하고, `src/content.config.ts`에서 import하여 `defineCollection`에 전달한다.

## 근거 (Rationale)

- 스키마 검증 로직을 Astro 런타임 없이 단위 테스트 가능 (TDD 워크플로 지원).
- content.config.ts가 얇아져 등록 구조가 명확.
- 향후 Keystatic 매핑(NOR-19) 시 스키마 재사용 용이.
- `astro/zod`에서 re-export되는 zod는 순수 라이브러리이므로 별도 모듈에서도 동일하게 사용 가능.

## 영향 (Consequences)

- 긍정: 테스트 용이, 관심사 분리, 재사용성.
- 부정/비용: 파일 하나 추가 (미미).
- 후속 작업: NOR-19(Keystatic)에서 schemas.ts를 참조하여 CMS 필드 매핑.
