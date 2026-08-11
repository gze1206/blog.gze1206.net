# gze1206.net

개인 블로그 v4 — Astro + TypeScript + Tailwind CSS.

## 기술 스택

- [Astro](https://astro.build/) (TypeScript strict)
- [Tailwind CSS](https://tailwindcss.com/) v4
- Content Collections + Markdoc
- Cloudflare 정적 배포

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

## 작성 경계

공개 블로그는 정적 HTML과 정적 자산만 배포한다. 작성, 비공개 보관, 공개용 콘텐츠 변환은 private
Tailnet 워크벤치의 책임이며 공개 배포 환경에는 작성 UI·API·인증 비밀값을 두지 않는다. 결정 배경은
[ADR 0016](./docs/decisions/0016-private-workbench-authoring.md)을 참고한다.

## 디렉터리 구조

```
src/
  components/   # 정적 Astro 컴포넌트
  content/      # Content Collections
  islands/      # 인터랙티브 아일랜드 (client:* 격리)
  layouts/      # 페이지 레이아웃
  pages/        # 정적 라우트
  styles/       # Tailwind 진입점·전역 스타일
public/         # 정적 에셋
docs/           # 규약·로드맵·산출물
```
