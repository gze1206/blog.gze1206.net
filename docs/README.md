# docs — Blog v4 (gze1206.net)

이 디렉토리는 블로그 재구축(v4)과 워크벤치를 함께 담은 모노레포의 계획·규약·산출물 문서를 모읍니다. 앱별로 나누지 않고 저장소 루트에 하나만 둡니다.

## 계획

- **[roadmap.md](./roadmap.md)** — 전체 일감(NOR-5 ~ NOR-36)과 **권장 처리 순서**(Phase 0~8), 의존성 다이어그램, 병렬화 힌트.

## 작업 규약 (conventions/)

- **[conventions/commits.md](./conventions/commits.md)** — 커밋 메시지 규약 (gitmoji + Conventional Commits + Linear ID).
- **[conventions/branch-pr.md](./conventions/branch-pr.md)** — 브랜치·PR 전략 (일감 단위 브랜치 + PR).
- **[conventions/coding.md](./conventions/coding.md)** — 코딩 컨벤션 (TS strict, 모노레포 구조·의존 방향, 린트·포맷, 테스트, CI).
- **[conventions/content-a11y-seo.md](./conventions/content-a11y-seo.md)** — 콘텐츠 계약·접근성(WCAG AA)·SEO 기본기.
- **[conventions/workflow.md](./conventions/workflow.md)** — 작업 흐름 (PRD·ADR·spec·plan·TDD, 선별 적용). 수용 기준·trailer·`tdd-evidence` 판정, 마무리 보안 검수.

## 산출물

- **[decisions/](./decisions/README.md)** — ADR (되돌리기 힘든 설계 결정). 모노레포 전환은 [0017](./decisions/0017-monorepo-with-workbench.md), 워크벤치 아키텍처 결정은 [0018](./decisions/0018-workbench-architecture-decisions.md).
- **[spec/](./spec/README.md)** — 일감 명세 + 구현 계획 (복잡한 일감). 영역별 하위 디렉터리 [`blog/`](./spec/blog/)·[`workbench/`](./spec/workbench/)·[`repo/`](./spec/repo/)(공유 계약은 `contract/`).
- **[operations/workbench/](./operations/workbench/)**: 워크벤치 운영 문서.
- **[superpowers/](./superpowers/)**: 설계(`specs/`)와 구현 계획(`plans/`). 모노레포 기반은 [설계](./superpowers/specs/2026-11-12-monorepo-foundation-design.md)·[1a 계획](./superpowers/plans/2026-11-12-monorepo-foundation-1a.md).
- **[prd/](./prd/README.md)** — 마일스톤 PRD (현재는 roadmap으로 갈음).

## 원본 일감 (Source of Truth)

일감의 최신 상태·상세는 Linear를 따릅니다. 이 문서들은 순서·맥락을 사람이 읽기 쉽게 정리한 사본입니다.

- Linear 프로젝트: **[Blog v4 — gze1206.net](https://linear.app/noru-kim/project/6b1bec66-83eb-42f2-b910-ef84ca522d3d)** (팀 `NOR`)

## 에이전트 가이드

- 저장소 작업 규약 허브는 루트 **[AGENTS.md](../AGENTS.md)** 입니다. (`CLAUDE.md`도 같은 문서를 가리킵니다.)
