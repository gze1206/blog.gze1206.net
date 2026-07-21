---
number: 0007
title: 미디어 임베드 전략 — 이미지 최적화·영상·YouTube
status: accepted
date: 2026-07-21
related: [NOR-14]
---

# 0007. 미디어 임베드 전략 — 이미지 최적화·영상·YouTube

## 맥락 (Context)

NOR-14에서 콘텐츠에 이미지·로컬 영상·YouTube를 삽입하는 방식을 결정해야 한다. 이미지 최적화(AVIF/WebP·반응형·lazy), YouTube 프라이버시·성능, 로컬 영상 재생, 시맨틱 캡션을 모두 고려해야 한다.

## 검토한 대안 (Options)

### 이미지

- **A안: Markdoc image 노드 오버라이드** — Markdoc의 기본 image 노드를 Astro 컴포넌트로 교체. 기존 `![alt](src)` 문법 유지하면서 lazy/반응형 적용.
- **B안: 커스텀 `{% image %}` 태그만 사용** — 기존 이미지 문법 무시하고 전용 태그 도입. 기존 문법과 호환 안 됨.

### YouTube

- **A안: 썸네일 + 클릭 시 iframe (점진적 향상)** — 초기 로드 시 썸네일만 표시, 클릭 시 iframe 삽입. JS 없으면 youtube-nocookie 직접 링크로 폴백.
- **B안: 즉시 iframe** — 간단하지만 성능·프라이버시 불리.

### 영상

- **A안: 네이티브 `<video>` + controls** — 브라우저 기본 컨트롤 활용, 접근성 기본 보장.
- **B안: 커스텀 플레이어** — 과도한 복잡도.

## 결정 (Decision)

이미지는 Markdoc image 노드 오버라이드(A안), YouTube는 점진적 향상(A안), 영상은 네이티브 video(A안)를 채택한다.

## 근거 (Rationale)

- **이미지**: 기존 `![alt](src)` 문법 호환을 유지하면서 lazy loading과 alt 필수를 보장한다. Astro의 `<Image>` 컴포넌트는 빌드타임에 로컬 이미지를 변환하지만, 콘텐츠 이미지는 public/ 또는 외부 URL이므로 네이티브 `<img>`에 lazy/decoding=async를 적용하는 것이 실용적이다.
- **YouTube**: 썸네일 선로드 방식은 iframe이 없어 초기 성능이 우수하고, youtube-nocookie.com으로 프라이버시를 보장한다. JS 미로드 시에도 링크로 접근 가능.
- **영상**: 네이티브 `<video>`는 브라우저 접근성·키보드 지원이 내장되어 있어 커스텀 플레이어 대비 이점이 크다.

## 영향 (Consequences)

- 긍정: 기존 이미지 문법 호환, YouTube 성능·프라이버시 향상, 접근성 기본 보장.
- 부정/비용: YouTube 점진적 향상은 클라이언트 JS 아일랜드가 필요(islands/ 격리).
- 후속 작업: 빌드타임 이미지 최적화(AVIF/WebP 변환)는 이미지 에셋 관리 체계(NOR 후속)에서 추가 가능.
