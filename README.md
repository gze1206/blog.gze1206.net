# gze1206.net

개인 블로그 v4 — Astro + TypeScript + Tailwind CSS.

## 기술 스택

- [Astro](https://astro.build/) (TypeScript strict)
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Keystatic](https://keystatic.com/) — GitHub 저장소 기반 원격 CMS, Cloudflare Worker UI/API 브리지

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

## 글쓰기 — Keystatic 원격 어드민

Keystatic은 GitHub storage를 사용한다. 공개 블로그는 정적 HTML로 prerender하고, 편집 UI와
`/api/keystatic/*`만 Cloudflare Worker에서 실행한다. 따라서 어디서나 브라우저로 작성할 수 있지만,
실제 원격 인증·배포는 아직 운영 환경에서 검증하지 않았다.

- 로컬/원격 환경 모두 `.env.example`의 네 변수 이름을 사용한다. 값은 커밋하지 않으며, 원격 값은
  Cloudflare Worker의 암호화된 비밀값/환경 변수로만 관리한다.
- GitHub App과 Cloudflare Access가 준비되기 전에는 원격 저장을 수행할 수 없다. 이 조건을 우회해
  공개 관리자 화면을 배포하지 않는다.
- 관리 대상: 글(`src/content/posts/*.mdoc`) · 시리즈(`src/content/series/*.json`) ·
  포트폴리오(`src/content/portfolio/*.json`).
- 손으로 쓴 `.md` 글은 어드민 목록에 뜨지 않는다. 커스텀 블럭이 필요 없는 단순한 글은 여전히 `.md`로
  써도 된다([ADR 0003](./docs/decisions/0003-md-mdoc-coexistence.md)).
- 필드 설명과 주의점(특히 시리즈·시리즈 순서는 **둘 다 채우거나 둘 다 비워야 한다**)은
  [spec NOR-19](./docs/spec/NOR-19-keystatic.md) 참고.
- 콘텐츠 브랜치 작성, preview 검토, `v4` 병합과 초안 발행 기준은
  [CMS 원격 작성과 안전한 발행](./docs/operations/cms-authoring.md)을 따른다.

## 디렉토리 구조

```
keystatic.config.ts  # GitHub storage CMS 스키마
src/
  components/   # 정적 Astro 컴포넌트
  content/      # Content Collections
  integrations/ # keystaticWorker()를 포함한 Astro 통합
  islands/      # 인터랙티브 아일랜드 (client:* 격리)
  layouts/      # 페이지 레이아웃
  pages/        # /api/keystatic 동적 Worker API를 포함한 라우트
  styles/       # Tailwind 진입점·전역 스타일
public/         # 정적 에셋
docs/           # 규약·로드맵·산출물
```

Astro는 `keystaticWorker()`로 `/keystatic` 동적 UI 라우트를 등록하고, Cloudflare Worker는
`/api/keystatic/*` 동적 API 라우트를 제공한다.
