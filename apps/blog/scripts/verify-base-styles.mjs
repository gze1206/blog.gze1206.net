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

/**
 * 글 상세의 모든 요소가 **한 열**을 쓰는지 확인한다 (NOR-150).
 *
 * 한때 제목·목차(948), 본문(900), 코드(980)가 저마다 다른 폭이었다. 역할의 위계를 폭으로
 * 말하려던 것이었지만 화면에서는 왼쪽 끝이 세 군데인 것으로만 보였고, 게다가 코드를 넓히는
 * 값이 `4vw` 라 좁은 화면에서는 화면 밖으로 삐져나가 페이지 전체에 가로 스크롤을 만들었다
 * (820px 화면에서 17px).
 *
 * 폭으로 말하고 싶어지면 이 검사가 먼저 걸린다.
 *
 * @param {string} css `src/styles/global.css` 내용
 * @returns {string[]} 위반 목록. 비어 있으면 통과.
 */
export function verifyReadingColumn(css) {
  const problems = [];

  if (css.includes('--code-bleed')) {
    problems.push('code blocks must not be widened out of the reading column');
  }
  if (css.includes('--spacing-reading-wide')) {
    problems.push('the article must not have a second, wider column');
  }
  // 바깥 상자는 읽기 열에서 파생되어야 한다. 숫자를 따로 적으면 둘이 어긋난다.
  if (!/--spacing-reading-frame:\s*calc\(var\(--spacing-reading\)/u.test(css)) {
    problems.push('the reading frame must be derived from the reading column');
  }
  return problems;
}
