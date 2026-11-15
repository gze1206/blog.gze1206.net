# gze1206.net

개인 블로그 v4 와 개인 작성 도구(워크벤치)를 함께 담은 pnpm 모노레포.

## 구성

| 경로                         | 패키지                      | 내용                                                                                                            |
| ---------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/blog/`                 | `@gze1206/blog`             | [Astro](https://astro.build/) 정적 블로그. Tailwind CSS v4, Content Collections + Markdoc, Cloudflare 정적 배포 |
| `apps/workbench/`            | `@gze1206/workbench`        | private Tailnet 작성 도구. Vite + React 클라이언트, Hono 서버, linux/arm64 Docker 이미지                        |
| `packages/content-contract/` | `@gze1206/content-contract` | 블로그와 워크벤치가 함께 쓰는 글·시리즈 스키마, slug 규칙, 블로그 레이아웃 상수                                 |
| `packages/config/`           | `@gze1206/config`           | 공통 TypeScript·ESLint 설정                                                                                     |
| `packages/repo-tools/`       | `@gze1206/repo-tools`       | 의존 경계·명세 연결·red→green 증거 검사기                                                                       |

`docs/` 에는 저장소 공통 규약, ADR, spec, 로드맵이 있다. 작업 규약의 시작점은 [AGENTS.md](./AGENTS.md) 다.

## 시작하기

Node 26 과 pnpm 11.15.0 이 필요하다. [mise](https://mise.jdx.dev/) 를 쓰면 `mise.toml` 이 두 버전을 맞춘다.

```bash
# 의존성 설치
pnpm install

# 블로그 개발 서버
pnpm dev:blog

# 워크벤치 개발 서버
pnpm dev:workbench

# 커밋 전 로컬 게이트 (typecheck, lint, format:check, test, build, boundaries, spec:check)
pnpm verify

# e2e (Playwright)
pnpm e2e

# 블로그 빌드 결과 미리보기
pnpm --filter @gze1206/blog build && pnpm --filter @gze1206/blog preview
```

## 작성 경계

공개 블로그는 정적 HTML과 정적 자산만 배포한다. 작성, 비공개 보관, 공개용 콘텐츠 변환은 private
Tailnet 워크벤치의 책임이며 공개 배포 환경에는 작성 UI·API·인증 비밀값을 두지 않는다. 결정 배경은
[ADR 0016](./docs/decisions/0016-private-workbench-authoring.md)을 참고한다.

워크벤치의 앱 코드는 이 저장소에 있지만 개인 기록은 별도의 private 저장소에 두며, 이 저장소는 개인 기록을
추적하지 않는다. 저장소를 합친 결정은 [ADR 0017](./docs/decisions/0017-monorepo-with-workbench.md), 워크벤치
아키텍처 결정은 [ADR 0018](./docs/decisions/0018-workbench-architecture-decisions.md)에 있다.
