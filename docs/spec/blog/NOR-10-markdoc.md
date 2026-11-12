---
issue: NOR-10
title: Markdoc 통합 & 커스텀 태그 등록 골격
status: in-progress
---

# NOR-10 — Markdoc 통합 & 커스텀 태그 등록 골격

> Linear: https://linear.app/noru-kim/issue/NOR-10

## 목표

`@astrojs/markdoc` 통합을 설치·구성하여 Content Collections의 posts 컬렉션에서 `.mdoc` 파일을 렌더할 수 있게 하고, 커스텀 태그(bookmark·github·callout) 3종의 등록 골격을 만든다. 기존 `.md` 글도 깨지지 않게 병행 지원한다.

## 입력 / 출력

- 입력: `.mdoc` 확장자의 Markdoc 콘텐츠 파일 (postSchema frontmatter 포함)
- 출력: Astro 빌드 시 정상 HTML 렌더, 커스텀 태그가 placeholder로 출력

## 동작 / 상태 전이

1. `@astrojs/markdoc` 설치 → `astro.config.mjs`에 통합 등록
2. `markdoc.config.mjs`에 커스텀 태그 3종(bookmark·github·callout) 정의
3. 각 태그에 대응하는 Astro 컴포넌트를 `src/components/markdoc/`에 placeholder로 생성
4. `src/content.config.ts`의 posts glob 패턴에 `.mdoc` 추가
5. 스모크 테스트용 `.mdoc` 글 작성 → 빌드 검증

## 성공 / 실패 조건

- 성공:
  - `pnpm build` 통과
  - `.md` 기존 글과 `.mdoc` 스모크 글 모두 빌드 성공
  - 커스텀 태그가 빌드 에러 없이 placeholder HTML로 출력
  - `pnpm lint` / `pnpm format:check` 통과
- 실패·예외:
  - 커스텀 태그 미등록 시 빌드 에러
  - 기존 `.md` 글이 깨지는 경우
  - TS strict 위반

## 엣지 케이스

- `.md`와 `.mdoc`이 같은 slug를 가지면 충돌 가능 → 현재는 중복 slug 생성하지 않음으로 회피
- 커스텀 태그에 필수 attribute 누락 시 빌드 에러 → attribute를 optional로 정의하되 validation은 후속 구현

## 검증 방법 (= TDD 테스트 목록)

- [x] `@astrojs/markdoc` 설치 및 `astro.config.mjs` 통합 등록 확인
- [x] `markdoc.config.mjs`에 bookmark·github·callout 태그 정의 확인
- [x] 각 태그의 Astro placeholder 컴포넌트 존재 확인
- [x] `src/content.config.ts`에서 `.mdoc` 패턴 포함 확인
- [x] 기존 `.md` 글(`hello-world.md`, `draft-example.md`) 빌드 정상
- [x] 커스텀 태그를 사용하는 `.mdoc` 스모크 글 빌드 정상
- [x] `pnpm lint` 통과
- [x] `pnpm build` 통과

## 구현 계획 (plan)

1. `@astrojs/markdoc` 설치 (`pnpm add`)
2. `astro.config.mjs`에 markdoc 통합 추가
3. `src/content.config.ts` glob 패턴에 `.mdoc` 확장자 추가
4. `markdoc.config.mjs` 생성 — 커스텀 태그 3종 골격 등록
5. `src/components/markdoc/` 에 Bookmark·GitHub·Callout placeholder 컴포넌트 생성
6. 스모크 테스트용 `.mdoc` 글 작성 (postSchema 준수, 커스텀 태그 사용)
7. ADR 작성 — `.md`/`.mdoc` 병행 지원 결정
8. `pnpm build` / `pnpm lint` / `pnpm format:check` 검증
9. 셀프 리뷰 루프 → PR 생성

## 완료 조건 (일감)

- [x] `@astrojs/markdoc` 설치 및 astro.config.mjs integrations에 등록
- [x] Content Collections와 연결: posts 컬렉션이 `.mdoc` 파일 지원
- [x] `markdoc.config.mjs`에 bookmark·github·callout 태그 골격 등록
- [x] 각 태그의 attributes 시그니처 정의
- [x] 커스텀 태그 사용하는 `.mdoc` 글 빌드/렌더 정상 출력
- [x] 기존 `.md` 글 깨지지 않음
- [x] TS strict / lint / format:check / build 전부 통과
