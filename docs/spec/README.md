# 일감 명세 (spec)

복잡한 일감의 착수 전 명세 + 구현 계획(plan)을 둡니다. TDD의 입력이 됩니다. 자세한 트리거·흐름은 [../conventions/workflow.md](../conventions/workflow.md) 참고.

## 규칙

- 위치: 영역별 하위 디렉터리 `docs/spec/<영역>/`.
  - [`blog/`](./blog/): 블로그(`apps/blog`)
  - [`workbench/`](./workbench/): 워크벤치(`apps/workbench`)
  - [`contract/`](./contract/): 공유 계약(`packages/content-contract`)과 두 앱에 걸친 기능
  - [`repo/`](./repo/): 저장소 공통(툴체인·CI·`packages/repo-tools`)
- 파일명: `NOR-N-제목-slug.md` (예: `blog/NOR-9-content-schema.md`). `pnpm spec:check` 는 이 파일명에서 일감 번호를 읽는다.
- 수용 기준은 `- **AC-n**` 목록 항목으로 쓰고, 자동화할 수 없으면 `(manual)` 을 붙인다. 테스트 이름에 `NOR-N AC-n:` 을 넣어 잇는다([workflow.md](../conventions/workflow.md#tdd)).
- 단순 일감은 spec 없이 로드맵 완료 조건으로 갈음.
- 템플릿: [`_template.md`](./_template.md)

## 목록

### 블로그 (`blog/`)

| 일감    | 제목                                                                              | 상태        |
| ------- | --------------------------------------------------------------------------------- | ----------- |
| NOR-9   | [Content Collections 스키마 정의](./blog/NOR-9-content-schema.md)                 | done        |
| NOR-149 | [시각 언어 재구축 (팔레트·읽기·홈·탐색)](./blog/NOR-149-visual-redesign.md)       | done        |
| NOR-10  | [Markdoc 통합 & 커스텀 태그 등록 골격](./blog/NOR-10-markdoc.md)                  | in-progress |
| NOR-11  | [Shiki + CIL(.NET) 커스텀 하이라이팅](./blog/NOR-11-shiki-cil.md)                 | in-progress |
| NOR-13  | [KaTeX 수식 + Mermaid 다이어그램](./blog/NOR-13-katex-mermaid.md)                 | in-progress |
| NOR-14  | [미디어 — 이미지 최적화 + 영상/YouTube 임베드](./blog/NOR-14-media.md)            | draft       |
| NOR-15  | [커스텀 블럭 — URL 북마크 · GitHub 카드 · 콜아웃](./blog/NOR-15-custom-blocks.md) | done        |
| NOR-16  | [블로그 목록/상세 + 카테고리·태그·시리즈 페이지](./blog/NOR-16-blog-pages.md)     | done        |
| NOR-17  | [글 상세 — TOC·헤딩 앵커·읽기 시간·작성/수정일](./blog/NOR-17-post-detail.md)     | done        |
| NOR-18  | [시리즈 내비게이션 (이전/다음 편)](./blog/NOR-18-series-nav.md)                   | done        |
| NOR-19  | [Keystatic 설치·구성 (Content Collections 매핑)](./blog/NOR-19-keystatic.md)      | done        |
| NOR-27  | [메타 위생 — title/description/canonical/robots/OG](./blog/NOR-27-meta.md)        | done        |
| NOR-28  | [OG 이미지 자동생성 (Satori)](./blog/NOR-28-og-images.md)                         | done        |

### 워크벤치 (`workbench/`)

| 일감    | 제목                                                                                                       | 상태 |
| ------- | ---------------------------------------------------------------------------------------------------------- | ---- |
| NOR-139 | [개인 워크벤치 아키텍처 스펙 (M1)](./workbench/2026-08-12-personal-workbench-architecture.md)              | done |
| NOR-143 | [Private Workbench M1 기반 명세](./workbench/NOR-143-workbench-foundation.md)                              | done |
| NOR-148 | [GHCR 이미지 배포·임시 발행 워크스페이스 스펙](./workbench/2026-08-13-workbench-ghcr-ephemeral-publish.md) | done |
| NOR-189 | [워크벤치 읽은 책 관리 명세](./workbench/NOR-189-book-management.md)                                       | done |

### 저장소 공통 (`repo/`)

| 일감    | 제목                                                                      | 상태 |
| ------- | ------------------------------------------------------------------------- | ---- |
| NOR-195 | [모노레포 기반 (하위 프로젝트 1a)](./repo/NOR-195-monorepo-foundation.md) | done |

### 공유 계약 (`contract/`)

| 일감    | 제목                                                                                | 상태 |
| ------- | ----------------------------------------------------------------------------------- | ---- |
| NOR-196 | [책 공개와 구절 인용 (하위 프로젝트 1b)](./contract/NOR-196-books-and-bookquote.md) | done |
