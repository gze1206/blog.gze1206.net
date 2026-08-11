---
number: '0015'
title: CMS 발행 런타임과 안전한 콘텐츠 워크플로
status: superseded by 0016
date: 2026-08-09
related: [NOR-20, NOR-136]
---

# 0015. CMS 발행 런타임과 안전한 콘텐츠 워크플로

> 2026-08-12: 이 결정은 [ADR 0016](./0016-private-workbench-authoring.md)로 대체됐다. 아래 내용은
> 당시 CMS 발행 런타임의 역사적 기록으로 보존한다.

## 맥락 (Context)

v4의 목적은 정적 블로그를 만드는 데 그치지 않는다. 작성자가 어느 기기에서든 글·포트폴리오·소개와
경력을 안전하게 편집하고, Markdoc 커스텀 블럭을 이용해 필요한 형식의 콘텐츠를 발행할 수 있어야 한다.

ADR 0012의 로컬 전용 Keystatic은 이 요구의 첫 단계였지만, 배포된 편집기·인증·원격 저장소·미리보기
흐름을 제공하지 못한다. 또한 현재 홈페이지 소개는 `src/pages/index.astro`에 고정돼 있어 CMS의 관리
대상이 아니다.

## 검토한 대안 (Options)

- **A안: GitHub 웹 편집만 사용** — 별도 런타임이 없고 안전하지만 휴대기기의 작성 경험이 나쁘며,
  Markdoc 블럭·이미지 폼·구조화된 포트폴리오/경력 편집을 제공하지 못한다.
- **B안: 정적 Cloudflare Pages는 유지하고 별도 Node 호스트에 관리자만 배포** — 공개 사이트의 형태를
  보존하지만 운영 대상·도메인·비밀값이 둘로 늘고, Keystatic의 Cloudflare 호환 가능성을 활용하지 못한다.
- **C안: Astro hybrid + Cloudflare Workers에 Keystatic을 함께 배포** — 공개 페이지는 사전 렌더된
  정적 자산으로 제공하고 `/keystatic`과 `/api/keystatic`만 Worker에서 실행한다. 한 저장소·한 배포
  경로로 GitHub 인증과 콘텐츠 저장을 운영할 수 있다. 단, Keystatic이 실제 Worker 런타임에서 동작함을
  빌드와 배포 미리보기로 증명해야 한다.

## 결정 (Decision)

**C안을 우선 구현하되, Worker 호환성 검증을 필수 게이트로 둔다.** `nodejs_compat`를 켠 Astro
Cloudflare Worker에서 Keystatic GitHub 모드를 실행하고, 일반 공개 경로는 prerender로 유지한다.
`@keystatic/astro` 기본 API 라우트는 Astro 6에서 제거된 환경 API를 참조하므로, UI 라우트 주입과
공개 `@keystatic/core/api/generic` 핸들러를 잇는 작은 Worker 브리지를 저장소가 소유한다. 로컬·미리보기에서
인증 왕복과 저장을 검증하지 못하면 B안으로 전환하며, 검증 실패 상태의 런타임을 공개 배포하지 않는다.

콘텐츠의 진실 원천은 GitHub 저장소다. 편집은 `v4`에서 분기한 `content/<slug>` 브랜치에서 시작하고,
Cloudflare 미리보기에서 전체 페이지를 검토한 뒤 `v4`로 병합한다. `draft: true`는 병합된 뒤에도
공개 산출물에서 제외되는 추가 안전장치다.

## 근거 (Rationale)

Cloudflare Worker는 정적 자산을 Assets 바인딩으로 제공하므로, 관리자 API를 추가해도 공개 페이지를
매 요청 SSR로 바꿀 필요가 없다. Astro 공식 Cloudflare 어댑터는 prerender와 온디맨드 라우트를 함께
지원하며, Cloudflare는 `nodejs_compat`로 다수 Node API를 제공한다. 다만 Keystatic 공식 문서는
Node API가 가능한 호스트를 요구할 뿐 Worker를 호환 대상으로 명시하지 않으므로, 문서만으로 성공을
가정하지 않는다. 실제로 기본 Astro 통합의 환경 변수 접근은 Worker에서 실패했으며, 이 브리지는 그
호환 경계를 한 파일에 제한한다.

GitHub 모드는 저장소에 대한 최소 권한 GitHub App과 기존 커밋 이력을 제공한다. 브랜치 미리보기와
`draft`를 함께 사용하면 오발행을 한 단계가 아니라 두 단계에서 막을 수 있다.

## 영향 (Consequences)

- 긍정: 브라우저 기반 작성, 커스텀 블럭, 이미지 업로드, Git 이력, 미리보기와 롤백이 한 흐름이 된다.
- 긍정: 글뿐 아니라 소개·경력·포트폴리오도 Content Collections와 Keystatic 스키마로 관리할 수 있다.
- 비용: 배포 대상은 기존 Pages 계획에서 Cloudflare Workers로 바뀐다. GitHub App 비밀값과 Cloudflare
  환경 변수, Access 정책은 외부 설정 단계에서만 추가한다.
- 비용: 기존 `.md` 글은 CMS가 일관되게 다룰 수 있도록 `.mdoc`으로 검증 후 이관해야 한다.
- 후속 작업: NOR-20은 런타임·GitHub 발행·기존 글 이관을 맡고, NOR-136은 소개·경력 데이터 모델과
  화면 렌더를 맡는다.
