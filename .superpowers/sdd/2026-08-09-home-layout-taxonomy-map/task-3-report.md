# Task 3 보고 — 홈 WebGL 제거와 포트폴리오 레이아웃

## 구현

- `InteractiveCanvas` 아일랜드와 Three/WebGL 보조 모듈·테스트를 제거했다. 홈의 prerendered HTML에는 캔버스가 없다.
- 프로필·포트폴리오·공개 글 컬렉션 호출과 JSON-LD 입력은 그대로 두고, 홈을 `home-hero` → 프로젝트 → 최근 글의 정적 정보 위계로 재구성했다.
- 히어로에는 `aria-hidden`인 `home-hero__decoration`만 두었다. 장식은 저대비 그리드·그라데이션 CSS이고, 애니메이션과 포인터 이벤트가 없다.
- 프로젝트 카드와 기술 토큰, 최근 글 영역에 공유 `home-*` 스타일 훅을 적용했다. `/topics` 그래프 코드·문서는 변경하지 않았다.
- `verifyHomeLayout(html)`과 단위 테스트를 추가해 캔버스 금지 및 필수 섹션 표지를 검사한다.

## RED 증거

생산 검증기를 만들기 전에 다음을 실행했다.

```text
pnpm test scripts/verify-home-layout.test.ts
Error: Cannot find module './verify-home-layout.mjs'
```

요구된 검증기 모듈이 아직 없어서 실패한 상태를 확인했다.

## GREEN 및 정적 출력 검증

```text
pnpm test scripts/verify-home-layout.test.ts
1 file passed, 2 tests passed

pnpm build
passed, 64 pages

node -e "…readFile('dist/index.html')…verifyHomeLayout(html)…"
passed
```

계획에 있던 `dist/client/index.html` 경로는 이 브랜치의 Astro 정적 출력과 맞지 않아 존재하지 않았다. `astro.config.mjs`가 정적 출력이고 실제 빌드 결과가 `dist/index.html`임을 확인한 뒤, 검증 대상만 실제 출력 경로로 바꿨다. 기능·검증 계약은 바꾸지 않았다.

## 최종 검증

```text
pnpm test
31 files passed, 308 tests passed

pnpm lint
passed

pnpm format:check
passed

pnpm build
passed, 64 pages

rg -n 'InteractiveCanvas|interactive-canvas|<canvas' src dist/index.html
no matches

git diff --check
passed
```

기존 Vite 500 kB 초과 청크 경고와 smoke 콘텐츠의 의도적인 블록 검증 경고는 빌드 중 계속 보이지만, 이번 변경으로 새 오류는 발생하지 않았다.

## 셀프 리뷰

- `home-hero__decoration`은 콘텐츠의 sibling이며 `aria-hidden="true"`, `pointer-events: none`이다. 장식 때문에 키보드 탐색이나 읽기 순서가 바뀌지 않는다.
- 홈은 그래프를 렌더하지 않고 `/topics`를 유일한 관계 그래프 위치로 유지한다.
- 프로젝트 링크의 새 탭 보안 속성(`rel="noopener noreferrer"`)과 글 카드의 제목·카테고리·태그 링크 계약을 보존했다.
- 정적 출력에서 `about-heading`, `stack-heading`, `portfolio-heading`, `recent-posts-heading`과 캔버스 부재를 다시 확인했다.

## 리뷰 수정

- 기존 검증기는 `home-hero` 클래스가 있을 때만 `about-heading`·`stack-heading`을 검사했다. 따라서 히어로 전체가 사라진 경우를 놓칠 수 있었다.
- hero 없는 fixture를 추가하고, 두 표지가 빠진 현재 동작을 먼저 확인했다.

```text
pnpm test scripts/verify-home-layout.test.ts
1 file failed, 2 tests failed
```

- `REQUIRED_SECTION_MARKERS` 하나에 소개·기술·프로젝트·최근 글 표지를 모두 넣어 HTML 구조와 무관하게 검사하도록 고쳤다.

```text
pnpm test scripts/verify-home-layout.test.ts
1 file passed, 3 tests passed
```

- `src`에서 `three` import/dynamic import/require가 없음을 확인한 뒤 `pnpm remove three`로 직접 의존성과 lockfile 항목을 제거했다.

```text
pnpm test       # 31 files, 309 tests passed
pnpm lint       # passed
pnpm format:check # passed
pnpm build      # passed, 64 pages
```

빌드된 `dist/index.html`에 다시 검증기를 실행했고, 소스·manifest·lockfile의 `three` 참조 검색과 `git diff --check`도 통과했다.

## 최종 리뷰 수정

- SVG에 `role="img"`를 주면 내부의 카테고리·태그 앵커가 보조 기술에서 하나의 이미지로 평탄화될 수
  있으므로 역할을 제거했다. `title`·`desc`와 `aria-labelledby`는 유지해 그래프 설명과 내부 링크의
  탐색성을 함께 보존한다.
- 관계 선택기에는 태그 → 직접 카테고리의 역방향 선택과, 한 홉 너머 태그·카테고리를 포함하지 않는
  회귀 계약을 추가했다. 이 선택기는 기존에도 양방향 한 홉만 반환했으므로 새 관계 테스트는 즉시
  통과했고, SVG 역할 계약은 먼저 실패한 뒤 수정으로 통과했다.
- 릴리스 체크리스트에서 제거된 `InteractiveCanvas`·Three.js 청크 설명을 CSS 장식 레이어와 Mermaid
  단일 청크 경고의 현재 상태로 갱신했다.
