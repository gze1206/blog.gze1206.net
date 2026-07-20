# 콘텐츠 · 접근성(a11y) · SEO 규약

이 블로그의 브랜딩 1순위는 **"크롤러도 사람도 읽는 정적 콘텐츠"** 입니다. 인터랙션은 그 위에 얹는 향상일 뿐입니다.

## 콘텐츠 계약 (Content Collections)

- 스키마는 `src/content` 의 zod 정의가 **단일 진실**(NOR-9). 필드 추가/변경은 스키마 → 타입 → 렌더 순으로.
- posts 필수 감각: `title`, `description`, 영문 `slug`, `category`, `tags[]`, `publishedAt`, `updatedAt`, `draft`. 시리즈 글은 `series` + `seriesOrder`.
- **`draft: true` 는 프로덕션 빌드에서 제외**(NOR-16). 목록·피드·사이트맵 어디에도 노출 금지.
- 본문은 **Markdoc**. 커스텀 블럭은 등록된 태그만 사용: `{% bookmark %}` · `{% github %}` · `{% callout %}`(NOR-15).

## 정적 우선 · 점진적 향상

- 루트/About/포트폴리오의 **경력·성과·링크는 실제 HTML 텍스트**로 렌더한다(NOR-21, NOR-23). JS로만 그리지 않는다.
- 인터랙티브 캔버스(Three.js/Phaser 등)는 **폴백 필수**: 미로드·저사양·`prefers-reduced-motion` 상황에서도 콘텐츠가 완전히 읽혀야 한다(NOR-22).
- 외부 링크는 `target="_blank"` + `rel="noopener"`(NOR-23).

## 접근성 (WCAG AA 기준)

- 시맨틱 마크업 + 랜드마크(`header`/`nav`/`main`/`footer`), 헤딩 계층 준수.
- 키보드 내비게이션·포커스 가시성 보장, **skip-link** 제공(NOR-26).
- 색 대비 AA 충족(코드블럭 다크/라이트 포함 — NOR-11).
- 모든 이미지 `alt`, 아이콘 버튼 `aria-label`(예: 코드 복사 버튼 — NOR-12).
- 커스텀 404도 접근성 기준 준수(NOR-26).
- 최종 감사에서 axe 이슈 0 목표(NOR-34).

## SEO 기본기

- 페이지별 **`title` / `description`**, `canonical`, `robots`, `lang="ko"`(NOR-27).
- **OG/Twitter 카드** 공통 컴포넌트, OG 이미지는 Satori로 빌드타임 생성(한글 폰트 임베드 — NOR-27, NOR-28).
- **JSON-LD**: 글 `Article`/`BlogPosting`, 경로 `BreadcrumbList`, About `Person`(NOR-29).
- **RSS/Atom + sitemap**, `robots.txt` 에 sitemap 참조(NOR-30).
- 런칭 시 Google Search Console 등록(NOR-36).

## 성능 (Core Web Vitals)

- 목표: LCP·CLS·INP 기준치 통과(NOR-34).
- 이미지 최적화(AVIF/WebP·lazy), 번들/이미지 예산 점검, 무거운 스크립트 지연 로드.
- 수식(KaTeX)·다이어그램(Mermaid)·임베드는 **CLS 없이** 안정 렌더(NOR-13).

## 관련 문서

- 코딩 컨벤션: [coding.md](./coding.md)
- 전체 처리 순서: [../roadmap.md](../roadmap.md)
