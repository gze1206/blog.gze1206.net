# NOR-203 — 워크벤치 디자인 정비와 라이트/다크 테마

- 출처: 사용자 요청(2026-11-15). 워크벤치도 디자인과 라이트/다크 테마를 개선해야 한다.

## 현재

- 라이트 테마만 있다. 컴포넌트가 Tailwind 원색 유틸리티(`stone-*`, `emerald-*`, `amber-*`, `red-*`, `white`,
  16진수)를 210번 직접 써서 다크 테마를 붙일 자리가 없다.
- 블로그(팔레트 02C, Pretendard·Noto Serif KR)와 시각 언어가 다르다. 제목은 Georgia, 본문은 시스템 글꼴이다.
- 오늘의 로그 입력의 "추가" 버튼이 좁아 글자가 세로로 줄바꿈된다.

## 결정

| 항목      | 결정                                                                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 색 토큰   | 블로그의 팔레트 02C 토큰을 새 패키지 `@gze1206/theme`(`tokens.css`)로 옮기고 블로그와 워크벤치가 함께 쓴다                                                      |
| 컴포넌트  | 원색 유틸리티를 의미 토큰(`background`, `surface`, `surface-sunken`, `foreground`, `body`, `muted`, `border`, `accent`, `notice`, `danger`, `scrim`)으로 바꾼다 |
| 테마 전환 | 블로그와 같은 방식: 라이트·다크·시스템, `localStorage`, `<html class="dark">`. 첫 그리기 전에 인라인 스크립트로 적용해 깜박임을 막는다                          |
| 글꼴      | 본문 Pretendard, 제목 Noto Serif KR 600(블로그와 같은 패키지)                                                                                                   |

## 수용 기준

- **AC-1** `@gze1206/theme` 토큰은 라이트·다크 모두에서 글자색(`foreground`, `body`, `muted`, `muted-strong`, `accent`, `danger`)이 `background`·`surface`·`surface-sunken` 위에서 4.5:1 이상이고, `notice-foreground` 는 `notice` 위에서 4.5:1 이상이다.
- **AC-2** 블로그와 워크벤치의 스타일은 `@gze1206/theme/tokens.css` 를 가져다 쓰고, 각자 `--theme-*` 값을 다시 정의하지 않는다.
- **AC-3** `resolveTheme(preference, systemDark)` 는 `light`·`dark` 는 그대로, `system` 은 시스템 설정을 따른다. 저장값이 없거나 잘못되면 `system` 이다.
- **AC-4** 워크벤치 화면 코드(`src/web`)는 원색 팔레트 유틸리티와 16진수 색을 쓰지 않는다.
- **AC-5** 테마 전환 버튼을 누르면 `<html>` 의 `dark` 가 바뀌고 새로고침 뒤에도 유지된다.
- **AC-6** 오늘의 로그 입력의 "추가" 버튼은 한 줄로 그려진다. 본문 글꼴은 Pretendard 로 시작한다.
