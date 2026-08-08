---
issue: NOR-20
title: Keystatic 블럭 삽입과 이미지 업로드
status: in-progress
---

# NOR-20 — Keystatic 블럭 삽입과 이미지 업로드

> Linear: https://linear.app/noru-kim/issue/NOR-20

## 목표

로컬 Keystatic 글 편집기에서 Markdoc `bookmark`, `github`, `callout` 블럭을 폼으로 삽입하고,
글 이미지를 `public/uploads/`에 저장해 `/uploads/` URL로 본문에 넣는다.

## 범위와 외부 보류 항목

ADR 0012의 완전 정적 출력은 유지한다. 따라서 GitHub OAuth 자격 증명과 공개 어드민 호스팅은
외부 공개 작업으로 보류한다. 이 저장소에는 비밀값·서버 어댑터·공개 `/keystatic` 라우트를 추가하지 않는다.

## 입력 / 출력

- 입력: Keystatic `fields.markdoc` 편집기에서 선택한 컴포넌트 블럭 또는 이미지 파일.
- 출력: 기존 `markdoc.config.mjs` 태그와 동일한 속성의 `.mdoc`, 그리고 `public/uploads/<file>` 및
  Markdown `/uploads/<file>` 참조.

## 검증 방법

- [ ] Keystatic 설정을 import한 테스트가 블럭 스키마와 이미지 디렉터리·publicPath를 확인한다.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build`가 통과하고 프로덕션 산출물에 `/keystatic`·`/api/keystatic`이 없다.
- [ ] `pnpm dev`에서 편집기가 기동하며 컴포넌트 블럭과 이미지 UI가 노출된다.

## 구현 계획

1. 설정 검사 테스트를 추가해 블럭 이름·속성·이미지 경로를 고정한다.
2. `keystatic.config.ts`의 Markdoc 필드에 세 컴포넌트 블럭과 이미지 구성을 매핑한다.
3. 개발 서버와 정적 빌드를 검증하고, 외부 GitHub 모드 준비 절차를 최종 외부 작업 보고서에 남긴다.
