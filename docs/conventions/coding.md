# 코딩 컨벤션

> 구체 스크립트/설정은 스캐폴딩(NOR-5)·규약 셋업(NOR-8) 완료 후 확정합니다. 확정되면 이 문서를 갱신하세요.

## 언어·타입

- **TypeScript strict**. `any` 지양, 불가피하면 주석으로 이유 명시.
- 콘텐츠 데이터는 항상 **Content Collections(zod) 스키마**를 통해 타입 안전하게 다룹니다. 필드를 바꿀 땐 코드가 아니라 **스키마부터** 수정(NOR-9).

## 디렉토리 구조

NOR-8에서 확정하는 기준 구조:

```
src/
  content/      # Content Collections (posts·series·portfolio) + config
  components/   # 정적 Astro 컴포넌트 (.astro)
  layouts/      # 페이지 레이아웃
  islands/      # 인터랙티브 아일랜드 (React/Three.js 등, client:* 로 격리)
  pages/        # 라우트
  styles/       # Tailwind 진입점·전역
public/         # 정적 에셋
docs/           # 계획·규약·산출물 (이 문서 포함)
```

- **인터랙티브 요소는 `islands/` 로 격리**하고 `client:visible` / `client:idle` 등으로 지연 로드. 정적 컴포넌트에 클라이언트 JS를 섞지 않는다.
- 라우트별 로직은 `pages/` 최소화, 재사용 로직은 `components/`·유틸로.

## 린트·포맷

- **ESLint + Prettier + `.editorconfig`** (NOR-8). 커밋 전 로컬에서 통과시킬 것.
- 명령(스캐폴딩 후 확정):
  - `pnpm lint`
  - `pnpm format` (또는 `prettier --write`)
- 가능하면 CI에서 린트 게이트를 건다.

## 네이밍

- 컴포넌트 파일: `PascalCase.astro` / `PascalCase.tsx`.
- 유틸·모듈: `kebab-case.ts`.
- 콘텐츠 슬러그: **영문 kebab-case** (posts는 영문 slug 규약 — NOR-9).
- 변수·함수: `camelCase`, 상수: `UPPER_SNAKE_CASE`, 타입/인터페이스: `PascalCase`.

## 성능 기본기

- 이미지는 Astro `<Image>`(AVIF/WebP·반응형·lazy) 사용(NOR-14). 원본 `<img>` 남발 금지.
- 클라이언트 번들 최소화 — 무거운 라이브러리(Three.js/Phaser/Mermaid 등)는 아일랜드 + 지연 로드.
- CLS 유발 요소(수식·다이어그램·임베드)는 자리 예약으로 레이아웃 안정화(NOR-13).

## 커밋 전 체크

1. `pnpm build` 성공 (출력 `dist/`).
2. `pnpm lint` 통과.
3. 관련 일감 완료 조건 충족.

## 관련 문서

- 접근성·SEO·콘텐츠: [content-a11y-seo.md](./content-a11y-seo.md)
- 커밋/브랜치: [commits.md](./commits.md) · [branch-pr.md](./branch-pr.md)

## 콘텐츠 스키마를 고친 뒤

Astro 의 콘텐츠 저장소(`node_modules/.astro/data-store.json`)는 **파일이 바뀔 때만** 다시
파싱한다. 스키마(`src/content/schemas.ts`)에 필드를 추가해도 기존 항목은 그 값이 비어 있는
채로 남고, 빌드가 그 자리에서 죽는다. 스키마를 고쳤다면 한 번 지우고 빌드한다.

```
rm -f node_modules/.astro/data-store.json && pnpm build
```

스키마 파일이 `content.config.ts` 와 분리돼 있어(ADR 0002) 설정 파일의 해시가 바뀌지 않기
때문이다.
