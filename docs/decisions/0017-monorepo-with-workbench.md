---
number: '0017'
title: 공개 블로그 저장소를 워크벤치와 합친 pnpm 모노레포로 전환
status: accepted
date: 2026-11-12
related: [NOR-195]
---

# 0017. 공개 블로그 저장소를 워크벤치와 합친 pnpm 모노레포로 전환

## 맥락 (Context)

공개 블로그(`blog.gze1206.net`, public)와 작성 도구 `personal-workbench`(private)는 따로 개발되어 왔다.
2026-11-12 분석에서 두 저장소가 나뉘어 생긴 어긋남이 확인됐다.

- **발행 계약 어긋남.** 블로그 `postSchema` 에는 `toc` 필드가 있는데(NOR-150), 워크벤치가 따로 들고 있던
  복제본은 `.strict()` 이면서 `toc` 가 없었다. 워크벤치는 `toc` 가 있는 글을 발행하지도, 가져오지도 못했다.
- **발행 대상 브랜치 불일치.** 워크벤치의 기본 대상 브랜치는 `main` 인데 블로그 저장소에는 `master` 와 `v4`
  만 있다.
- **책 공개 경로 부재.** NOR-189 는 읽은 목록을 블로그로 내보낼 수 있다고 정했지만 내보내는 길이 없다.
  NOR-188 은 `cover` 형태 차이를 남은 간극으로 적어 두었다.

세 문제 모두 같은 계약을 두 저장소가 각자 들고 있어서 생겼다. 계약을 한 곳에 두려면 저장소 배치를 먼저
정해야 한다. 상세 설계는 [모노레포 기반 설계](../superpowers/specs/2026-11-12-monorepo-foundation-design.md)에 있다.

## 검토한 대안 (Options)

- **A안: 공개 저장소 `blog.gze1206.net` 을 모노레포로 바꾸고 워크벤치를 합친다.** GitHub 이력과 Cloudflare
  연동을 그대로 쓰고, 공개 저장소의 arm64 러너로 워크벤치 이미지를 네이티브 빌드할 수 있다. 대신 워크벤치
  코드가 공개되므로 들이기 전에 공개 전 검수가 필요하다.
- **B안: 새 private 모노레포를 만들어 둘을 옮긴다.** 코드는 비공개로 남는다. 대신 블로그 이력과 Cloudflare
  연동을 새 저장소로 옮겨야 하고, 공개 블로그의 소스가 비공개가 된다.
- **C안: 워크벤치 저장소(private) 쪽으로 블로그를 합친다.** B안과 같은 비용에 더해, 저장소 이름과 기본
  브랜치(`main`)가 블로그 배포 설정과 맞지 않는다.

## 결정 (Decision)

**A안을 선택한다.** `blog.gze1206.net` 을 `apps/blog` + `apps/workbench` + `packages/*` 구성의 pnpm
모노레포로 바꾸고, 글·시리즈 계약을 `@gze1206/content-contract` 하나로 단일화한다.

## 근거 (Rationale)

- 워크벤치 코드에는 비밀이 없다. 개인 기록은 별도 저장소(WORKSPACE_ROOT)에 있고, 앱 저장소는 사용자
  콘텐츠를 추적하지 않는다.
- private 이력은 공개하지 않는다. 워크벤치는 원본 커밋 `8453402` 의 현재 트리를 **스냅샷 한 커밋**으로
  들였다. 그 트리 전체를 gitleaks, 식별 정보 검색, 운영 문서 수동 검토로 확인한 뒤 커밋했다.
- 블로그는 `git mv` 로 옮겨 rename 감지로 이력을 잇는다. 이동 전후 `dist/` 를 비교해, 경로에서 나오는 해시(아일랜드
  `uid`, 이미지 변환 파일명)와 Tailwind 소스 감지 범위가 좁아져 빠진 미사용 유틸리티 2개 말고는 산출물이 같음을
  확인했다.
- 두 앱이 같은 계약 객체를 import 하므로 필드를 하나 더하면 양쪽에 동시에 반영된다. 블로그는
  `postSchema` 를, 워크벤치 발행기는 같은 규칙에 모르는 키 거부를 더한 `strictPostSchema` 를 쓴다.
- 앱끼리, 패키지에서 앱으로의 import 는 `pnpm boundaries` 가 막는다.

ADR 0016 의 작성 경계(작성·비공개 보관·변환은 워크벤치, 공개 배포는 정적 산출물만)는 그대로 유지된다.
0016 이 전제한 "워크벤치 코드는 별도 private 저장소에 둔다"는 저장소 분리 서술만 이 ADR 이 개정한다.
그래서 0016 은 superseded 가 아니다.

## 영향 (Consequences)

- 긍정: 계약 어긋남이 구조적으로 사라진다. 워크벤치가 `toc` 를 지키고, 발행 경로와 기본 대상 브랜치를
  `BLOG_LAYOUT` 에서 가져온다.
- 긍정: 한 저장소의 CI 가 두 앱과 계약을 함께 검증한다(`.github/workflows/ci.yml`).
- 비용: 공개 저장소에 들이는 코드와 문서는 매번 공개 전 검수 기준(Tailnet 도메인, Tailscale IP, 호스트명,
  개인 이메일, 로컬 절대 경로)을 지켜야 한다.
- 비용: Cloudflare 빌드 루트를 저장소 루트에서 `apps/blog` 로 바꿔야 한다.
- 비용: 워크벤치의 발행 경로가 `src/content/posts` 에서 `apps/blog/src/content/posts` 로 바뀐다
  (`BLOG_LAYOUT.postsDir`).
- 후속 작업: 원본 `personal-workbench` 저장소를 archive 로 돌리고, GHCR 패키지 `personal-workbench`(이름
  유지)의 Actions 접근 권한을 이 저장소에 준다. 둘 다 실행 직전에 사용자 확인을 받는다.
- 후속 작업: 책 공개와 인용(NOR-196), 워크벤치 배포(NOR-198), 블로그 공개 배포와 `publishBranch`
  확정(NOR-199), 댓글 서버 교체(NOR-200)는 각 하위 프로젝트에서 다룬다.
