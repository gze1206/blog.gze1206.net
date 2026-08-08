---
issue: NOR-22
title: 인터랙티브 캔버스 레이어
status: in-progress
---

# NOR-22 — 인터랙티브 캔버스 레이어 (점진적 향상)

> Linear: https://linear.app/noru-kim/issue/NOR-22

## 목표

홈의 소개 영역에 개발자 블로그의 분위기를 더하는 가벼운 점·연결선 배경을 추가한다. 자바스크립트가
없거나 장치 조건이 맞지 않아도 기존 소개·포트폴리오·글 목록은 같은 정적 HTML로 읽혀야 한다.

## 결정

Three.js를 선택한다. Phaser는 게임 장면과 입력 모델에는 적합하지만, 한 장의 장식적 WebGL 레이어에는
렌더러와 장면만 쓰는 Three.js가 더 작고 목적에 맞다. 홈의 `client:visible` React 아일랜드가 관찰
영역에 들어온 뒤에만 Three.js 모듈을 동적 import한다.

캔버스는 포인터가 있는 데스크톱에서만 아주 느린 시점 이동으로 반응한다. 모바일, `prefers-reduced-motion`,
저사양 힌트(논리 코어 4 이하 또는 device memory 4GB 이하), WebGL 불가 환경에서는 시작하지 않는다.
그 경우 CSS의 정적인 약한 그라데이션만 보인다. 캔버스는 장식이므로 `aria-hidden`이며 포커스를 받지 않는다.

## 입력 / 출력

- 입력: 뷰포트 크기, 밝음/어두움 테마, 포인터 좌표, 장치 능력 힌트.
- 출력: 소개 섹션 뒤의 2D 점·연결선 WebGL 장면 또는 정적 CSS 폴백.

## 동작 / 상태 전이

1. 서버는 캔버스 호스트와 기존 정적 소개를 함께 렌더한다.
2. 호스트가 보이면 아일랜드가 장치 조건을 판별한다.
3. 조건을 통과하면 Three.js를 동적 import하여 장면을 만들고, 크기 변경·포인터 이동을 반영한다.
4. 호스트가 해제되면 animation frame, 이벤트, renderer와 canvas를 정리한다.
5. 조건 미달·import 실패·WebGL 실패는 예외를 화면에 노출하지 않고 CSS 폴백을 유지한다.

## 성공 / 실패 조건

- 성공: Three.js가 초기 Astro 페이지 번들에 포함되지 않고, 홈 영역이 보인 뒤에만 로드된다.
- 성공: 축소 모션·모바일·저사양에서 WebGL 초기화 없이 정적 콘텐츠와 CSS 폴백이 남는다.
- 성공: 키보드 탐색과 스크린 리더의 랜드마크·헤딩 순서에 장식 레이어가 관여하지 않는다.
- 실패: 캔버스가 본문을 가리거나, WebGL 오류가 보이거나, 해제 후 animation frame/event listener가 남는다.

## 엣지 케이스

- `navigator.deviceMemory`는 일부 브라우저에 없으므로 값이 없으면 이를 이유로 차단하지 않는다.
- 사용 중 OS의 움직임 감소 설정이 바뀌면 다음 페이지 방문에서 다시 평가한다.
- `WebGLRenderer` 생성 또는 동적 import 실패는 조용히 폴백한다.
- 화면 크기와 DPR은 매 resize에서 반영하고 DPR은 1.5로 상한을 둔다.

## 검증 방법 (= TDD 테스트 목록)

- [ ] `shouldEnableInteractiveCanvas()`가 모바일·축소 모션·저사양을 거르고 데스크톱 정상 조건만 허용한다.
- [ ] `getCanvasTheme()`가 light/dark 색 팔레트를 결정한다.
- [ ] `pnpm build` 산출물에서 Three.js 참조가 홈의 초기 엔트리가 아닌 별도 지연 청크에 존재한다.
- [ ] 브라우저에서 정상 조건의 캔버스 생성, 축소 모션 폴백, 키보드/axe 회귀 없음을 확인한다.

## 구현 계획 (plan)

1. 장치 정책과 테마 팔레트를 순수 TypeScript 유틸로 정의하고 실패하는 Vitest를 먼저 만든다.
2. 테스트를 통과하는 최소 판별 구현을 만든다.
3. `three` 의존성을 추가하고, `InteractiveCanvas.tsx`에서 visible 후 동적 import·장면 lifecycle을 구현한다.
4. `index.astro`의 소개 영역에 `client:visible` 아일랜드와 CSS 폴백 컨테이너를 추가한다.
5. 캔버스의 pointer/resize/cleanup 및 모션·성능 폴백을 브라우저에서 확인한다.
6. 전체 테스트·린트·빌드·포맷, 산출물 청크 검증, 셀프 리뷰를 통과시킨 후 Linear에 결과를 기록한다.

## 완료 조건 (일감)

- [ ] Three.js 아일랜드를 `client:visible`으로 적용한다.
- [ ] 모바일·저사양·`prefers-reduced-motion` 폴백을 제공한다.
- [ ] Three.js가 초기 렌더 경로에서 지연 로드됨을 검증한다.
