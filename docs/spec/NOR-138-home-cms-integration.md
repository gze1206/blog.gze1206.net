---
issue: NOR-138
title: CMS 소개·경력을 새 홈 레이아웃에 통합
status: in-progress
---

# NOR-138 — CMS 소개·경력을 새 홈 레이아웃에 통합

> Linear: https://linear.app/noru-kim/issue/NOR-138

## 목표

NOR-137의 정적 포트폴리오형 홈을 유지하면서, NOR-136의 CMS `profile`·`experience` 데이터를
소개·기술·공개 경력 영역에 연결한다. 이 작업은 두 브랜치의 `src/pages/index.astro` 병합 충돌을
해소하고, 개인 경력의 비공개 경계를 보존한다.

## 입력 / 출력

- 입력: `getProfile()`의 `name`, `headline`, `introduction`, `skills`와
  `getVisibleExperiences()`가 반환한 공개 경력 목록.
- 출력: prerendered 홈 HTML의 소개·기술·경력·프로젝트·최근 글 영역. 경력 컬렉션이 비어 있으면
  경력 섹션 자체를 렌더하지 않는다.

## 동작 / 상태 전이

1. 홈은 profile과 visible experiences를 다른 콘텐츠와 병렬로 읽는다.
2. hero의 eyebrow, 제목, 소개문과 기술 토큰은 profile 값을 렌더한다.
3. visible experiences가 하나 이상일 때만 `experience-heading` 섹션을 렌더한다.
4. `visible: false` 항목은 기존 `getVisibleExperiences()` 경계에서 제거된 채 홈 및 JSON-LD에
   전달되지 않는다.

## 성공 / 실패 조건

- 성공: NOR-136과 NOR-137을 포함한 통합 트리가 충돌 없이 만들어지고, 홈은 Canvas 없이 기존
  시맨틱 marker를 유지하며 CMS profile 데이터를 사용한다.
- 실패: 홈에 하드코딩한 개인 소개/기술/경력을 남기거나, `getCollection('experience')`를 직접 읽어
  `visible` 필터를 우회하거나, profile 콘텐츠 누락으로 빌드가 실패한다.

## 엣지 케이스

- 공개 경력이 없으면 빈 목록·빈 섹션을 노출하지 않는다.
- 공개 경력은 `getVisibleExperiences()`가 정한 현재 재직 우선·종료일 내림차순을 그대로 사용한다.
- Canvas/WebGL은 재도입하지 않으며, `about-heading`, `stack-heading`, `portfolio-heading`,
  `recent-posts-heading` marker를 모두 보존한다.

## 검증 방법 (= TDD 테스트 목록)

- [ ] 통합 홈 소스 검증은 `getProfile`과 `getVisibleExperiences`를 함께 사용하고 profile의 네 필드를
      렌더하는지 확인한다.
- [ ] 공개 경력 렌더가 `experiences.length > 0`으로 조건부이며, `getCollection('experience')` 직접
      접근이 없는지 확인한다.
- [ ] 기존 `verifyHomeLayout` 테스트와 전체 build가 Canvas 부재 및 네 시맨틱 marker를 확인한다.
- [ ] `selectVisibleExperiences` 테스트와 build 결과로 `visible: false` 비노출 경계를 회귀 확인한다.

## 구현 계획 (plan)

1. NOR-20 최신 브랜치 위에서 NOR-136과 NOR-137을 통합하고, `index.astro` 충돌은 NOR-137의
   구조·클래스를 기준으로 해소한다.
2. 홈 CMS 연결을 검증하는 실패 테스트를 먼저 작성하고, profile·공개 경력 데이터 호출과 조건부
   렌더를 최소 변경으로 추가한다.
3. focused·전체 테스트, lint, format, build를 통과시킨 뒤 셀프 리뷰와 독립 리뷰를 수행한다.

## 완료 조건 (일감)

- [ ] CMS 소개·기술·공개 경력이 새 홈 레이아웃에 표시된다.
- [ ] 비공개 경력은 정적 HTML과 JSON-LD에 노출되지 않는다.
- [ ] NOR-136·NOR-137·NOR-20 변경이 로컬에서 충돌 없이 통합되고 품질 게이트를 통과한다.
- [ ] 외부 배포·CMS 인증은 이 일감에서 수행하지 않는다.
