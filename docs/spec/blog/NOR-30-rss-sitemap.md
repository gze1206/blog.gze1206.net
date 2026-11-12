---
issue: NOR-30
title: RSS/Atom 피드 + 사이트맵
status: done
---

# NOR-30 — RSS/Atom 피드 + 사이트맵

> Linear: https://linear.app/noru-kim/issue/NOR-30

## 목표

공개 글을 구독할 수 있는 RSS 2.0 피드와, 검색 엔진이 사용할 정적 사이트맵을 생성한다.

## 결정

- RSS는 Markdoc 본문 전문이 아니라 Zod 스키마로 검증된 `description` 요약을 제공한다. 독자는
  정규 `/blog/[slug]` URL에서 전문을 읽는다.
- RSS는 `draft: true` 글을 내보내지 않으며, 카테고리와 태그는 중복을 제거한 RSS `<category>`로
  제공한다.
- 사이트맵은 Astro의 `site`·`trailingSlash` 설정을 따르고 `/smoke` 및 그 하위 검증 경로만 제외한다.
- `robots.txt`는 `https://gze1206.net/sitemap-index.xml`을 선언한다.

## 검증 방법

- [x] `toRssItems` 단위 테스트: draft 제외, 정규 URL, 요약, 중복 없는 분류
- [x] `isSitemapPage` 단위 테스트: `/smoke`만 제외하고 `/blog/smoke-test-post`는 유지
- [x] `pnpm build`: `dist/rss.xml`, `dist/sitemap-index.xml`, `dist/sitemap-0.xml`, `dist/robots.txt` 생성
- [x] 산출물 검사: RSS `ko-KR`, 미선언 Atom 접두사 없음, 사이트맵 smoke 제외, robots sitemap 참조
- [x] 전체 테스트·린트·포맷 및 셀프리뷰

## 완료 기록

- 구현 커밋: `0cfb021` (`✨ feat(feed): RSS와 사이트맵 생성 (NOR-30)`)
- 전체 검증: `pnpm test` 26 파일·296 테스트, `pnpm lint`, `pnpm build`, `pnpm format:check` 통과
- XML 검증: `xmllint --noout dist/rss.xml dist/sitemap-index.xml dist/sitemap-0.xml` 통과
- 빌드 경고: Mermaid 지연 청크의 Vite 500KB 경고는 NOR-34 감사 기록과 동일하게 유지한다.

## 남은 위험

`site`는 정규 도메인 `https://gze1206.net`으로 이미 고정돼 있다. 실제 도메인 연결(NOR-7) 전에는
피드와 사이트맵의 공개 URL 도달성만 검증할 수 없다.
