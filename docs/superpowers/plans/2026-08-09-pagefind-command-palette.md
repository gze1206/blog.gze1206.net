# Pagefind 검색 팔레트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** 정적 Pagefind 인덱스와 키보드 접근 가능한 cmdk 검색 팔레트를 제공한다.

**Architecture:** `src/lib/search.ts`는 단축키·검색어 계약을, `SearchPalette.tsx`는 cmdk 대화상자와 Pagefind 지연 import를 맡는다. Astro 헤더는 폴백 링크를 유지하고 `postbuild`가 `dist`를 인덱싱한다.

**Tech Stack:** Astro, React 19, cmdk, Pagefind, Vitest.

## Global Constraints

- 공개 글 본문만 색인하고 `/smoke/`, RSS, sitemap, 404는 제외한다.
- 링크는 JS 미지원 시 `/blog`로 정상 동작한다.
- 모든 생산 코드 전에 실패하는 Vitest를 확인한다.
- `pnpm build` 뒤 `dist/pagefind/pagefind.js`의 존재와 실제 검색 결과를 검사한다.

### Task 1: 빌드 인덱스 계약

**Files:** `package.json`, `pnpm-lock.yaml`, `src/lib/search.ts`, `src/lib/search.test.ts`, `src/layouts/PostLayout.astro`.

- [ ] 실패 테스트로 `isSearchShortcut({key:'k', metaKey:true})`와 두 글자 최소 검색어를 정의한다.
- [ ] 테스트가 모듈 부재로 실패함을 확인한다.
- [ ] 순수 유틸을 최소 구현하고 Pagefind를 dev 의존성으로 설치한다.
- [ ] `<main data-pagefind-body>`를 글 레이아웃에 표시하고, `postbuild`에서 `pagefind --site dist`를 실행한다.
- [ ] 빌드 후 공개 글 검색·비색인 URL을 CLI/API로 검사하고 커밋한다.

### Task 2: cmdk 팔레트 아일랜드

**Files:** `src/islands/SearchPalette.tsx`, `src/components/SiteHeader.astro`, `src/styles/global.css`, `src/lib/search.test.ts`.

- [ ] 단축키·최소 검색어의 실패 테스트를 추가하고 실행한다.
- [ ] `cmdk`를 설치한 뒤 열기/닫기, 입력, 로딩·오류·빈 결과, 결과 링크를 구현한다.
- [ ] Pagefind는 대화상자가 열리고 최소 길이 검색어가 입력될 때만 import한다.
- [ ] 헤더의 `/blog` 폴백 링크를 클릭 시 팔레트로 승격하고 Escape 포커스 복귀를 검사한다.
- [ ] 키보드 스모크 테스트와 린트를 통과하고 커밋한다.

### Task 3: 산출물·완료 기록

**Files:** `docs/spec/NOR-31-pagefind.md`.

- [ ] `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm format:check` 실행.
- [ ] Pagefind 산출물과 실제 결과, 폴백 링크·키보드 동작을 확인.
- [ ] 셀프리뷰·커밋 후 Linear 완료 댓글과 Done 상태 전환.
