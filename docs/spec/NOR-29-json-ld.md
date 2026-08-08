---
issue: NOR-29
title: JSON-LD 구조화 데이터
status: done
---

# NOR-29 — JSON-LD 구조화 데이터

- 홈은 공개 소개 범위만 담은 `Person`을 출력한다.
- 글 상세는 `BlogPosting`(발행·수정일, 저자)과 `BreadcrumbList`를 함께 출력한다.
- `SeoMeta`가 구조화 데이터 스크립트의 유일한 출력 지점이다.

## 검증

- JSON-LD 생성기 Vitest 2건 통과
- 빌드 산출물의 홈 Person, 글 BlogPosting·BreadcrumbList JSON 파싱 확인
- `pnpm lint`, `pnpm build`, `pnpm format:check` 통과
- 구현 커밋: `0ac56d6`
