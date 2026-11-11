/**
 * 코드블럭 구문 강조 테마의 **단일 출처** (NOR-162, NOR-34).
 *
 * 하이라이팅 경로가 둘이다 — `.md` 는 Astro 의 `markdown.shikiConfig`, `.mdoc` 는
 * `markdoc.config.mjs` 의 자체 하이라이터를 탄다. 각자 테마를 적어 두면 한쪽만 바뀌어
 * 같은 사이트에서 글 형식에 따라 코드 색이 달라진다. 실제로 그렇게 어긋난 적이 있다.
 *
 * ### 테마를 고른 기준
 *
 * 코드도 본문과 같은 글자다. 대비 기준(WCAG AA 4.5:1)에서 예외가 아니다. 처음 고른
 * Everforest Light 는 낮은 대비가 그 테마의 성격이라, 실제로 쓰인 색 9개 중 8개가 기준에
 * 못 미쳤다 — 전부 보정하면 더 이상 그 테마가 아니다. 그래서 라이트는 애초에 대비를
 * 목표로 만든 테마로 바꾸고, 다크는 Tokyo Night 를 유지하되 모자란 색만 보정한다.
 */
export const SHIKI_THEMES = {
  light: 'github-light-high-contrast',
  dark: 'tokyo-night',
} as const;

/**
 * 테마 색 중 우리 코드 면 위에서 AA 에 못 미치는 것만 골라, **색상은 두고 밝기만** 옮긴다.
 *
 * 기준 배경은 `--theme-code-surface` (라이트 `#f2eee7`, 다크는 Tokyo Night 의 `#1a1b26`).
 * 테마를 통째로 바꾸는 대신 실제로 렌더된 색만 손대므로 원래 인상이 유지된다.
 */
export const SHIKI_COLOR_REPLACEMENTS = {
  // 테마 파일이 색을 어떤 대소문자로 적어 두었는지에 따라 치환이 갈린다. 둘 다 적는다 —
  // 실제로 CIL 문법 경로에서 대문자 표기 하나가 빠져나간 적이 있다.
  'tokyo-night': {
    // 주석. 2.50 → 4.66
    '#51597d': '#7b84aa',
    '#51597D': '#7b84aa',
  },
  'github-light-high-contrast': {
    // 주석. 4.36 → 4.69 (코드 면 #f2eee7 기준)
    '#66707b': '#616b75',
    '#66707B': '#616b75',
  },
} as const;
