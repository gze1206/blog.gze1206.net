/**
 * 화면 어디에나 걸려 있는 기본 스타일이 살아 있는지 확인한다 (NOR-157).
 *
 * 이 규칙들은 특정 페이지의 것이 아니라 **전역**이라, 다른 섹션을 정리하다가 통째로 사라져도
 * 어느 페이지도 실패하지 않는다. 실제로 한 번 그렇게 사라졌고(건너뛰기 링크가 모든 화면
 * 왼쪽 위에 노출됐다), 빌드·테스트는 모두 통과했다. 그래서 여기서 이름으로 붙잡아 둔다.
 */

const REQUIRED_RULES = [
  ['.skip-link {', 'skip link style is missing — it would render on every page'],
  ['transform: translateY(-200%)', 'skip link must stay off-screen until focused'],
  ['.theme-toggle {', 'theme toggle style is missing'],
  ['.heading-anchor {', 'heading anchor style is missing'],
  ['a:focus-visible,', 'global focus ring is missing'],
  ['scroll-margin-top', 'anchor jump offset is missing'],
  ['scroll-behavior: smooth', 'smooth scroll for anchor jumps is missing'],
];

/**
 * @param {string} css `src/styles/global.css` 내용
 * @returns {string[]} 사라진 규칙 목록. 비어 있으면 통과.
 */
export function verifyBaseStyles(css) {
  return REQUIRED_RULES.filter(([needle]) => !css.includes(needle)).map(([, message]) => message);
}
