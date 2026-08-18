/**
 * 코드블럭 구문 강조 테마의 **단일 출처** (NOR-162).
 *
 * 하이라이팅 경로가 둘이다 — `.md` 는 Astro 의 `markdown.shikiConfig`, `.mdoc` 는
 * `markdoc.config.mjs` 의 자체 하이라이터를 탄다. 각자 테마를 적어 두면 한쪽만 바뀌어
 * 같은 사이트에서 글 형식에 따라 코드 색이 달라진다. 실제로 그렇게 어긋난 적이 있다.
 *
 * 팔레트 02C Mineral / Warm Paper 와 같은 계열을 고른다. 배경은 테마 것을 쓰지 않고
 * `--theme-code-surface` 로 준다 — 라이트 테마의 배경이 본문 종이와 거의 같기 때문이다.
 */
export const SHIKI_THEMES = {
  light: 'everforest-light',
  dark: 'tokyo-night',
} as const;
