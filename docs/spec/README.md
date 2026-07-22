# 일감 명세 (spec)

복잡한 일감의 착수 전 명세 + 구현 계획(plan)을 둡니다. TDD의 입력이 됩니다. 자세한 트리거·흐름은 [../conventions/workflow.md](../conventions/workflow.md) 참고.

## 규칙

- 파일명: `NOR-N-제목-slug.md` (예: `NOR-9-content-schema.md`).
- 단순 일감은 spec 없이 로드맵 완료 조건으로 갈음.
- 템플릿: [`_template.md`](./_template.md)

## 목록

| 일감   | 제목                                                                         | 상태        |
| ------ | ---------------------------------------------------------------------------- | ----------- |
| NOR-9  | [Content Collections 스키마 정의](./NOR-9-content-schema.md)                 | done        |
| NOR-10 | [Markdoc 통합 & 커스텀 태그 등록 골격](./NOR-10-markdoc.md)                  | in-progress |
| NOR-11 | [Shiki + CIL(.NET) 커스텀 하이라이팅](./NOR-11-shiki-cil.md)                 | in-progress |
| NOR-13 | [KaTeX 수식 + Mermaid 다이어그램](./NOR-13-katex-mermaid.md)                 | in-progress |
| NOR-14 | [미디어 — 이미지 최적화 + 영상/YouTube 임베드](./NOR-14-media.md)            | draft       |
| NOR-15 | [커스텀 블럭 — URL 북마크 · GitHub 카드 · 콜아웃](./NOR-15-custom-blocks.md) | done        |
| NOR-16 | [블로그 목록/상세 + 카테고리·태그·시리즈 페이지](./NOR-16-blog-pages.md)     | done        |
| NOR-17 | [글 상세 — TOC·헤딩 앵커·읽기 시간·작성/수정일](./NOR-17-post-detail.md)     | done        |
| NOR-18 | [시리즈 내비게이션 (이전/다음 편)](./NOR-18-series-nav.md)                   | done        |
| NOR-19 | [Keystatic 설치·구성 (Content Collections 매핑)](./NOR-19-keystatic.md)      | done        |
| NOR-27 | [메타 위생 — title/description/canonical/robots/OG](./NOR-27-meta.md)        | done        |
| NOR-28 | [OG 이미지 자동생성 (Satori)](./NOR-28-og-images.md)                         | done        |
