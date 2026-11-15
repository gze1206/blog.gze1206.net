# Public 블로그 CMS 제거 설계

- Linear: [NOR-140](https://linear.app/noru-kim/issue/NOR-140)
- 관련: [NOR-139](https://linear.app/noru-kim/issue/NOR-139)
- 상태: 사용자 요청 반영, 구현 계획 작성 전
- 작성일: 2026-08-12

## 결정

public 블로그에서 Keystatic CMS와 이를 지원하는 동적 Cloudflare Worker 실행 경로를 제거한다. 작성·비공개 보관·공개 변환은 Tailnet 전용 private 워크벤치가 담당한다.

이는 콘텐츠 자체를 제거하는 작업이 아니다. 기존 public `.mdoc` 포스트, `profile.json`, `experience/` JSON 컬렉션, Markdoc 렌더러와 현재 URL은 보존한다.

## 제거 대상

- Keystatic UI 라우트(`/keystatic/*`)와 API 라우트(`/api/keystatic/*`)
- Keystatic Worker 통합과 GitHub storage 설정
- GitHub App용 `KEYSTATIC_*` 환경 변수 예시와 운영 절차
- Keystatic 전용 설정, 테스트, Worker 빌드 검사, 의존성
- Keystatic 관리자에서 만들었던 왕복 검증용 샘플 포스트

이전 선택을 설명하는 ADR과 과거 구현 spec·plan은 삭제하지 않는다. ADR 0012·0015는 새 결정으로 superseded 처리하고, 과거 문서는 역사 기록으로 남긴다.

## 유지 대상

- Astro, Tailwind, Markdoc, Content Collections, Pagefind, React 아일랜드
- 모든 공개 경로의 현재 URL·canonical·RSS·sitemap·OG 생성
- 콘텐츠 schema와 slug 검증의 일반 목적 코드
- profile·experience를 직접 읽는 현재 홈 렌더링
- Cloudflare 배포 자체. 단, CMS 때문에 필요했던 동적 runtime 요구는 없앤다.

`@astrojs/react`와 React는 현재 검색·테마·분류 그래프 아일랜드가 사용하므로 제거 대상이 아니다.

## 빌드와 배포 경계

모든 public 라우트가 사전 렌더되는 Astro static output으로 돌아가야 한다. Astro 공식 문서도 정적 사이트에는 Cloudflare adapter가 필요 없다고 설명한다. 따라서 구현 단계에서 adapter와 Worker 전용 `wrangler` 배포 설정을 제거하고, 정적 `dist/` 자산을 Cloudflare에 배포하는 설정으로 바꾼다. 실제 Cloudflare 프로젝트·도메인 설정 변경과 production 배포는 별도 외부 작업으로 미룬다. [Astro Cloudflare adapter 문서](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)

## 안전 규칙

- `pnpm build`가 성공하고 `dist/`에 공개 페이지·RSS·sitemap·Pagefind 산출물이 생기기 전에는 설정을 확정하지 않는다.
- 정적 출력으로 바꾼 뒤 `/keystatic`과 `/api/keystatic/*`가 404인지 확인한다.
- 공개 콘텐츠·자산은 삭제하지 않는다. 샘플 검증 글만 별도 확인 뒤 제거한다.
- Cloudflare에 등록했을 수 있는 GitHub App secret과 Access 규칙은 코드 제거 후 외부 정리 체크리스트로 남기며, 이 로컬 작업에서 계정 설정을 변경하지 않는다.

## 검증

- Keystatic 의존성·설정·동적 라우트가 저장소에 남지 않는다. 단, 과거 문서와 공개 글의 역사적 언급은 허용한다.
- `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm build`가 통과한다.
- 기존 공개 핵심 경로, RSS, sitemap, robots가 정적 preview에서 성공한다.
- `/keystatic`, `/api/keystatic/tree`는 404다.
- 기존 포스트, profile, experience가 빌드·렌더링에서 계속 보인다.

## 제외 범위

- private 워크벤치 구현
- public 블로그의 새로운 편집 UI
- Cloudflare 계정의 비밀값 삭제, Access 정책 제거, 실제 production 배포

## 이후 순서

이 설계는 private 워크벤치 설계의 보완이다. 사용자 검토 후 `NOR-140`의 상세 구현 계획을 작성하고, 삭제·static 배포 전환·문서/ADR 정리를 분리된 단계로 실행한다.
