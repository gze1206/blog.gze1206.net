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
 * 코드 블록이 화면 밖으로 나가지 않는지 확인한다 (NOR-150).
 *
 * 코드는 본문보다 넓은 면이지만, 넓힐 자리가 없는 화면에서까지 넓히면 **페이지 전체에 가로
 * 스크롤**이 생긴다. 실제로 그런 적이 있다 — 여백을 `4vw` 로 두는 바람에 화면이 400~980px 일 때
 * 글의 좌우 여백(16px)보다 커져서, 820px 화면에서 코드가 17px 씩 잘려 나갔다.
 *
 * 넓힘값은 **화면 크기에 비례하면 안 된다**. 넓힐 자리가 생기는 폭에서 미디어 쿼리로 한 번에
 * 바꾸는 것만 안전하다.
 *
 * @param {string} css `src/styles/global.css` 내용
 * @returns {string[]} 위반 목록. 비어 있으면 통과.
 */
export function verifyCodeBleed(css) {
  const problems = [];
  const declarations = [...css.matchAll(/--code-bleed:\s*([^;]+);/gu)].map(([, value]) =>
    value.trim(),
  );

  if (declarations.length === 0) {
    problems.push('code bleed variable is missing');
    return problems;
  }
  if (declarations[0] !== '0px') {
    problems.push('code bleed must start at 0 — narrow screens have no room to widen into');
  }
  for (const value of declarations) {
    if (/\d\s*(vw|vi|cqw|cqi)\b/u.test(value)) {
      problems.push(`code bleed must not scale with the viewport: ${value}`);
    }
  }
  return problems;
}
