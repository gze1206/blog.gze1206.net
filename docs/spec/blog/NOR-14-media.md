---
issue: NOR-14
title: 미디어 — 이미지 최적화 + 영상/YouTube 임베드
status: draft
---

# NOR-14 — 미디어: 이미지 최적화 + 영상/YouTube 임베드

> Linear: https://linear.app/noru-kim/issue/NOR-14

## 목표

콘텐츠에서 이미지·영상·YouTube를 최적화된 형태로 삽입할 수 있게 하고, 시맨틱 캡션(figure/figcaption)과 접근성을 기본으로 보장한다.

## 입력 / 출력

- 입력: Markdoc(.mdoc) 콘텐츠에서 `![alt](src)` 이미지, `{% youtube %}`, `{% video %}`, `{% figure %}` 태그 사용
- 출력: 최적화된 이미지(lazy, responsive), YouTube 프라이버시 임베드, 로컬 영상 재생, 시맨틱 figure/figcaption

## 컴포넌트

### 1. Figure (캡션 래퍼)

- `{% figure caption="..." alt="..." %}` 태그로 이미지/영상을 figure/figcaption 시맨틱 마크업으로 감싼다.
- children으로 이미지/영상 Markdoc 문법 또는 태그를 받는다.

### 2. YouTube 임베드

- `{% youtube id="..." title="..." /%}` self-closing 태그.
- 프라이버시: `youtube-nocookie.com` 도메인 사용.
- 성능: 썸네일 + 재생 버튼 → 클릭 시 iframe 로드 (점진적 향상).
- 접근성: iframe title 필수, prefers-reduced-motion 존중.
- CLS 방지: 16:9 aspect-ratio 자리 예약.

### 3. 로컬 영상 (Video)

- `{% video src="..." title="..." /%}` self-closing 태그.
- `<video>` 네이티브 컨트롤, preload="metadata".
- 접근성: controls 필수, prefers-reduced-motion 시 autoplay 차단.

### 4. Markdoc 이미지 노드 커스터마이즈

- Markdoc의 기본 `image` 노드를 Astro 컴포넌트로 오버라이드.
- `alt` 속성 필수 전달, lazy loading, 반응형 이미지 처리.

## 검증 방법

- [ ] Markdoc `![alt](url)` 이미지가 lazy loading + alt 속성으로 렌더됨
- [ ] `{% youtube id="..." title="..." /%}` 태그가 썸네일 → iframe 점진적 향상으로 렌더됨
- [ ] `{% video src="..." /%}` 태그가 네이티브 video 컨트롤로 렌더됨
- [ ] `{% figure caption="..." %}` 태그가 figure/figcaption 시맨틱 마크업으로 렌더됨
- [ ] SVG 인라인 이미지 허용
- [ ] 접근성: alt 필수, iframe title, prefers-reduced-motion
- [ ] CLS 방지: YouTube 16:9 자리 예약, 이미지 width/height
- [ ] pnpm build 성공, pnpm lint 통과
- [ ] 스모크 테스트 페이지(/smoke/media)에서 모든 미디어 타입 확인

## 구현 계획

1. ADR 0007: 미디어 임베드 전략 결정
2. Markdoc image 노드 오버라이드 컴포넌트 (`MarkdocImage.astro`)
3. YouTube 임베드 컴포넌트 (`YouTube.astro`) — 점진적 향상(아일랜드)
4. Video 컴포넌트 (`Video.astro`)
5. Figure 캡션 컴포넌트 (`Figure.astro`)
6. markdoc.config.mjs에 태그/노드 등록
7. 스모크 테스트용 콘텐츠 + 페이지 작성
8. 전역 CSS 추가 (미디어 컴포넌트 스타일)
9. 빌드·린트 검증 + 셀프 리뷰
