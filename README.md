# gze1206.net

개인 블로그 v4 — Astro + TypeScript + Tailwind CSS.

## 기술 스택

- [Astro](https://astro.build/) (TypeScript strict)
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Keystatic](https://keystatic.com/) — 개발 서버에서만 뜨는 로컬 모드 CMS

## 시작하기

```bash
# 의존성 설치
pnpm install

# 개발 서버
pnpm dev

# 프로덕션 빌드
pnpm build

# 빌드 결과 미리보기
pnpm preview
```

## 글쓰기 — Keystatic 어드민 (로컬 모드)

```bash
pnpm dev            # 개발 서버를 띄우고
# 브라우저에서 http://localhost:4321/keystatic
```

- 어드민은 **개발 서버에서만** 뜬다. `pnpm build` 산출물에는 `/keystatic` 이 존재하지 않는다
  (근거: [ADR 0012](./docs/decisions/0012-keystatic-integration-strategy.md)).
- **로컬 모드**라 저장하면 작업 트리의 파일이 바로 바뀐다. 커밋은 직접 한다.
- 관리 대상: 글(`src/content/posts/*.mdoc`) · 시리즈(`src/content/series/*.json`) ·
  포트폴리오(`src/content/portfolio/*.json`).
- 손으로 쓴 `.md` 글은 어드민 목록에 뜨지 않는다. 커스텀 블럭이 필요 없는 단순한 글은 여전히 `.md`
  로 써도 된다([ADR 0003](./docs/decisions/0003-md-mdoc-coexistence.md)).
- 필드 설명과 주의점(특히 시리즈·시리즈 순서는 **둘 다 채우거나 둘 다 비워야 한다**)은
  [spec NOR-19](./docs/spec/NOR-19-keystatic.md) 참고.

## 디렉토리 구조

```
keystatic.config.ts  # CMS 스키마 (dev 전용 어드민)
src/
  components/   # 정적 Astro 컴포넌트
  content/      # Content Collections
  integrations/ # Astro 통합 (Keystatic dev 전용 등록 등)
  islands/      # 인터랙티브 아일랜드 (client:* 격리)
  layouts/      # 페이지 레이아웃
  pages/        # 라우트
  styles/       # Tailwind 진입점·전역 스타일
public/         # 정적 에셋
docs/           # 규약·로드맵·산출물
```
