# gze1206.net

개인 블로그 v4 — Astro + TypeScript + Tailwind CSS.

## 기술 스택

- [Astro](https://astro.build/) (TypeScript strict)
- [Tailwind CSS](https://tailwindcss.com/) v4

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

## 디렉토리 구조

```
src/
  components/   # 정적 Astro 컴포넌트
  content/      # Content Collections
  islands/      # 인터랙티브 아일랜드 (client:* 격리)
  layouts/      # 페이지 레이아웃
  pages/        # 라우트
  styles/       # Tailwind 진입점·전역 스타일
public/         # 정적 에셋
docs/           # 규약·로드맵·산출물
```
