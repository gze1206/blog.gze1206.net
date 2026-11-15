# Pagefind 검색 팔레트 설계

## 목표

정적 배포 산출물에 Pagefind 인덱스를 만들고, 헤더에서 접근 가능한 `⌘K`/`Ctrl+K` 검색 팔레트를
제공한다. JavaScript 없이도 검색 진입점은 `/blog` 링크로 남는다.

## 선택지와 결정

1. Pagefind 기본 UI를 그대로 삽입한다. 구현은 가장 짧지만 헤더·테마·키보드 상호작용이 사이트와
   어긋나고 Linear의 shadcn 커맨드팔레트 요구를 충족하지 못한다.
2. Pagefind JavaScript API와 React 아일랜드로 팔레트를 만든다. **채택**. 기존 React 및
   `react-aria` 의 접근성 기반을 재사용하고, 검색 코드는 사용자 요청 뒤에만 불러온다.
3. 서버 검색 API를 만든다. 정적 우선 원칙과 Cloudflare 외부 작업 제외 범위에 맞지 않는다.

## 인터페이스와 데이터 흐름

`SiteHeader.astro`는 `/blog`로 향하는 정적 검색 링크와 `SearchPalette` 아일랜드를 함께 둔다.
아일랜드는 링크를 가로채 열리며, `Meta+K` 또는 `Control+K`로도 열린다. 열릴 때만
`/pagefind/pagefind.js`를 동적 import하고, 입력 문자열로 `pagefind.search()`를 호출한다.

각 검색 결과는 Pagefind의 `data()`로 지연 조회한다. 제목은 링크, 추출문은 `excerpt`의 안전한
하이라이트 HTML로 표시한다. 입력은 최소 두 글자부터 검색하고, 빈 결과·로딩·오류를 상태 메시지로
명시한다. Escape는 닫고 호출 버튼에 포커스를 돌려준다.

## 빌드와 색인

`postbuild`가 `astro build` 뒤 `dist`를 Pagefind에 넘겨 `/pagefind/` 정적 인덱스를 만든다.
`/smoke/`, 404, RSS, 사이트맵은 `data-pagefind-ignore` 또는 Pagefind CLI exclude로 색인하지
않는다. 공개 글의 `<main>`에는 `data-pagefind-body`를 넣어 공통 헤더·푸터가 결과를 오염시키지
않게 한다.

## 접근성과 점진적 향상

팔레트는 `role="dialog"`, `aria-modal`, 제목, 레이블 있는 입력, `aria-live` 결과 상태를 갖는다.
키보드 이동은 Tab/Shift+Tab의 대화상자 포커스 트랩과 결과 링크의 기본 Tab·Enter 동작을 사용한다.
별도 화살표 선택 모델을 만들지 않아 보조기기와 동작이 갈라지지 않는다. `prefers-reduced-motion`은
전환 애니메이션을 추가하지 않아 자동으로 존중한다.

## 검증

- 순수 유틸 테스트: 단축키 판정과 검색어 최소 길이
- 브라우저 검사: 링크 클릭, `⌘K`/`Ctrl+K`, Escape 복귀, 결과 링크 키보드 이동
- 빌드 검사: `dist/pagefind/pagefind.js` 생성, smoke·RSS URL 비색인, 공개 글 검색 결과 확인
- 전체 `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm format:check`

## 범위 제외

오타 보정, 서버 검색, 검색 분석, 문서가 아닌 포트폴리오의 별도 인덱싱은 포함하지 않는다.
