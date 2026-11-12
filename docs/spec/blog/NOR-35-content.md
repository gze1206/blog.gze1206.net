---
issue: NOR-35
title: 첫 글 작성과 About 콘텐츠 보강
status: done
---

# NOR-35 — 첫 글 작성 + About 콘텐츠 채우기

## 결과

- `hello-world`를 실제 공개 글 **「블로그 v4를 시작하며」**로 확장했다. 기존 글을 보존하고
  정적 우선·Content Collections·Markdoc·코드 하이라이팅·검색·지연 로드 원칙을 설명한다.
- 홈 About은 공개 범위를 넓히지 않고, 기존에 확인된 게임·웹·서버 경험과 C# 중심 기술 선택을
  정적 HTML 텍스트로 보강했다.
- 포트폴리오는 검증 가능한 실제 항목인 `블로그 v4`를 유지한다. 확인하지 못한 외부 프로젝트나
  개인 정보를 추측해 추가하지 않았다.
- 글 전용 OG 이미지 `dist/og/blog/hello-world.png`가 생성되며, 제목·브랜드 표기를 직접 확인했다.

## 검증

- `pnpm test` — 29 파일, 307 테스트 통과
- `pnpm lint`, `pnpm build`, `pnpm format:check` 통과
- 생성된 글 HTML에 본문·`og:image`가 있고, 홈 HTML에 보강한 About 문구가 있음을 확인
- 구현 커밋: `dd427fc`
