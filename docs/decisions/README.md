# Architecture Decision Records (ADR)

번복하기 어려운 설계 결정을 1건 1파일로 기록합니다. 자세한 트리거·흐름은 [../conventions/workflow.md](../conventions/workflow.md) 참고.

## 규칙

- 파일명: `NNNN-제목-slug.md` (4자리 번호 증가, 예: `0001-base-theme.md`).
- 결정이 뒤집히면 **새 ADR**을 쓰고, 기존 ADR의 status를 `superseded by NNNN`으로 표시(삭제 금지).
- 템플릿: [`_template.md`](./_template.md)

## 목록

| 번호 | 제목                                                                                                      | 상태     | 관련 일감 |
| ---- | --------------------------------------------------------------------------------------------------------- | -------- | --------- |
| 0001 | [ESLint flat config 채택](./0001-eslint-flat-config.md)                                                   | accepted | NOR-8     |
| 0002 | [콘텐츠 스키마를 별도 모듈로 분리](./0002-content-schema-module-separation.md)                            | accepted | NOR-9     |
| 0003 | [posts 컬렉션에서 .md와 .mdoc 병행 지원](./0003-md-mdoc-coexistence.md)                                   | accepted | NOR-10    |
| 0004 | [CIL 하이라이팅 — grammar 출처 및 테마 전략](./0004-cil-grammar-and-theme-strategy.md)                    | accepted | NOR-11    |
| 0005 | [코드블럭 강화 — Shiki Transformer + 인라인 스크립트](./0005-codeblock-enhancement-strategy.md)           | accepted | NOR-12    |
| 0006 | [Mermaid 렌더링 전략 — 클라이언트 아일랜드](./0006-mermaid-rendering-strategy.md)                         | accepted | NOR-13    |
| 0007 | [미디어 임베드 전략 — 이미지 최적화·영상·YouTube](./0007-media-embed-strategy.md)                         | accepted | NOR-14    |
| 0008 | [커스텀 블럭 데이터 취득 전략 — 빌드타임 fetch + 캐시 + 폴백](./0008-custom-block-data-strategy.md)       | accepted | NOR-15    |
| 0009 | [블로그 라우팅 · 슬러그 · draft 처리 전략](./0009-blog-routing-slug-draft-strategy.md)                    | accepted | NOR-16    |
| 0010 | [헤딩 id 규칙 · 읽기 시간 산정 · 목차/스크롤 스파이 전략](./0010-heading-id-reading-time-toc-strategy.md) | accepted | NOR-17    |
