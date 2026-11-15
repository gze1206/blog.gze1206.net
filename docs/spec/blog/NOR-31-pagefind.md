---
issue: NOR-31
title: Pagefind 검색 + 커맨드팔레트 UI
status: done
---

# NOR-31 — Pagefind 검색 + 커맨드팔레트 UI

## 구현

- `postbuild`가 `dist`에서 Pagefind 인덱스를 생성한다.
- 글 상세의 `article[data-pagefind-body]`만 색인해 공통 UI·smoke·RSS·사이트맵을 제외한다.
- 헤더 검색은 JS 없이 `/blog`로 이동하고, JS에서는 cmdk 대화상자로 승격된다.
- `⌘K`/`Ctrl+K`, Escape 포커스 복귀, 최소 2글자 검색, 로딩·오류·빈 결과 상태를 제공한다.

## 검증

- `pnpm test`: 27 파일·298 테스트 통과
- `pnpm lint`, `pnpm build`, `pnpm format:check` 통과
- 빌드: 21개 공개 글·1개 언어(ko) Pagefind 색인, `dist/pagefind/pagefind.js` 생성
- 브라우저: 헤더 링크, 팔레트 대화상자, `Astro` 검색 결과와 하이라이트, Escape 닫기 확인

## 커밋

- `0f4a101` — Pagefind 정적 인덱스 생성
- `ef9db9a` — 키보드 검색 팔레트 추가
