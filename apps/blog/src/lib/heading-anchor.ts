/**
 * 헤딩 옆 앵커 링크의 공통 계약 (NOR-17).
 *
 * `.md`(rehype) 와 `.mdoc`(Markdoc) 이 서로 다른 렌더러로 같은 마크업을 만들어야 하므로,
 * 클래스 이름과 접근 가능한 이름을 여기 한 곳에 둔다.
 *
 * ### 앵커가 텍스트를 갖지 않는 이유
 *
 * 앵커의 자식으로 `#` 같은 글자를 넣으면 두 가지가 동시에 망가진다.
 *
 * 1. 렌더러가 헤딩 텍스트를 모을 때 그 글자가 섞여 들어가 **TOC 텍스트가 오염**된다.
 * 2. 스크린리더가 "링크, 우물 정"으로 읽는다.
 *
 * 그래서 앵커는 **자식이 없는 빈 링크**로 만들고, 보이는 기호는 CSS `::before` 가 그리고,
 * 접근 가능한 이름은 `aria-label` 이 준다(`global.css` 의 `.heading-anchor` 참고).
 */

/** 앵커 링크 클래스. 스타일·검증(dist grep) 이 이 이름을 기준으로 한다. */
export const HEADING_ANCHOR_CLASS = 'heading-anchor';

/**
 * 앵커의 접근 가능한 이름.
 *
 * "링크"·"#" 같은 이름만 있으면 스크린리더의 링크 목록에서 어디로 가는 링크인지 알 수 없다.
 * 헤딩 텍스트를 넣어 목적지를 이름만으로 알 수 있게 한다.
 * (헤딩 텍스트 자체가 중복인 글에서는 이름도 중복된다 — 그건 콘텐츠의 성질이라 여기서 못 고친다.)
 */
export function headingAnchorLabel(headingText: string): string {
  const text = headingText.trim();
  return text.length > 0 ? `${text} 섹션 링크` : '이 섹션 링크';
}
