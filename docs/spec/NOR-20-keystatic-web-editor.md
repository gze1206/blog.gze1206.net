---
issue: NOR-20
title: Keystatic 원격 웹 에디터와 안전한 발행
status: in-progress
---

# NOR-20 — Keystatic 블럭 삽입과 이미지 업로드

> Linear: https://linear.app/noru-kim/issue/NOR-20

## 목표

브라우저에서 GitHub 인증으로 Keystatic을 열어 Markdoc `bookmark`, `github`, `callout` 블럭과
이미지를 편집하고, 미리보기 검토 뒤 안전하게 발행한다.

## 범위와 외부 보류 항목

ADR 0015에 따라 공개 콘텐츠는 prerender를 유지하고, Keystatic UI/API만 Cloudflare Worker에서 실행한다.
`@keystatic/astro`의 Astro 6 환경 API 의존은 저장소의 Worker 브리지로 격리한다. GitHub App 비밀값과
Cloudflare Access 정책은 저장소에 기록하지 않는다. 인증·저장 검증을 통과하지 못하면 별도 Node 관리자
런타임으로 전환하며, 검증되지 않은 공개 어드민은 배포하지 않는다.

## 입력 / 출력

- 입력: GitHub로 인증한 작성자가 content 브랜치의 Keystatic `fields.markdoc` 편집기에서 선택한
  컴포넌트 블럭 또는 이미지 파일.
- 출력: 기존 `markdoc.config.mjs` 태그와 동일한 속성의 `.mdoc`, `public/uploads/<file>`,
  Cloudflare 미리보기, 그리고 `v4` 병합 뒤의 공개 정적 페이지.

## 검증 방법

- [x] Worker 빌드 검사와 Keystatic 설정 테스트가 GitHub 저장소·블럭 스키마·이미지 경로를 확인한다.
- [x] Worker 빌드와 로컬 preview에서 `/keystatic`·`/api/keystatic`이 동적 라우트로 응답한다.
- [ ] 휴대기기에서 GitHub 인증, 블럭 3종 삽입, 이미지 업로드, branch preview 렌더를 확인한다.
- [ ] `draft: true` 콘텐츠가 공개 빌드·RSS·사이트맵·검색에 나오지 않음을 확인한다.

## 구현 계획

1. Astro Cloudflare Worker 호환성 스파이크와 Keystatic API 브리지를 테스트·로컬 preview로 증명한다.
2. Keystatic을 GitHub 모드로 전환하고 기존 작성 대상 글을 `.mdoc`으로 이관한다.
3. GitHub App·Cloudflare Access·브랜치 미리보기 발행 절차를 비밀값 없이 문서화하고 실기기에서 검증한다.
