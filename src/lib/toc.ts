/**
 * 목차(TOC) 트리 구성 (NOR-17, ADR 0010).
 *
 * 입력은 렌더러가 돌려준 헤딩 목록이다(`render(post)` 의 `headings`). **렌더러가 실제로 붙인 id**
 * 를 그대로 쓰기 때문에 TOC 링크의 `href` 와 본문 헤딩 `id` 가 어긋날 수 없다.
 * `.md`(rehype) 와 `.mdoc`(Markdoc) 은 렌더 경로가 다르지만 이 자료구조로 만나 같은 함수를 탄다.
 */

/** 렌더러가 돌려주는 헤딩 한 줄. Astro 의 `MarkdownHeading` 과 구조가 같다. */
export interface HeadingRef {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}

/** TOC 항목. 중첩은 한 단계까지만 생긴다({@link TOC_MAX_DEPTH} 참고). */
export interface TocEntry {
  readonly id: string;
  readonly text: string;
  readonly children: readonly TocEntry[];
}

/**
 * TOC 에 담는 헤딩 깊이 범위.
 *
 * 글 제목이 `h1` 이므로 본문 헤딩은 `h2` 부터다. `h4` 이하까지 넣으면 목차가 본문만큼 길어져
 * "훑어보기"라는 목적을 잃는다. 그래서 `h2`~`h3` 두 단계로 자른다(ADR 0010).
 */
const TOC_MIN_DEPTH = 2;
const TOC_MAX_DEPTH = 3;

/**
 * TOC 를 렌더할 최소 헤딩 수.
 *
 * 헤딩이 0~1개인 글에서 목차는 정보가 아니라 소음이다. 항목 하나짜리 목차 상자는 만들지 않는다.
 */
const TOC_MIN_HEADINGS = 2;

/**
 * 헤딩 목록에서 TOC 트리를 만든다.
 *
 * @returns 담을 헤딩이 {@link TOC_MIN_HEADINGS} 개 미만이면 **빈 배열**.
 *          호출부는 이때 TOC 를 렌더하지 않는다 — 판단은 이 함수 하나가 한다.
 */
export function buildToc(headings: readonly HeadingRef[]): TocEntry[] {
  const usable = headings.filter(
    (heading) =>
      heading.depth >= TOC_MIN_DEPTH &&
      heading.depth <= TOC_MAX_DEPTH &&
      heading.slug.length > 0 &&
      heading.text.trim().length > 0,
  );

  if (usable.length < TOC_MIN_HEADINGS) return [];

  const roots: TocEntry[] = [];
  /** 지금 열려 있는 최상위(h2) 항목의 자식 목록. 아직 h2 가 없으면 `null`. */
  let openChildren: TocEntry[] | null = null;

  for (const heading of usable) {
    const id = heading.slug;
    const text = heading.text.trim();

    if (heading.depth === TOC_MIN_DEPTH) {
      const children: TocEntry[] = [];
      roots.push({ id, text, children });
      openChildren = children;
      continue;
    }

    // h2 없이 h3 가 먼저 나오는 글도 있다. 부모가 없으면 최상위로 올린다 — 조용히 버리지 않는다.
    (openChildren ?? roots).push({ id, text, children: [] });
  }

  return roots;
}

/** 글 frontmatter 의 `toc` 값. `false` 는 목차를 아예 만들지 않는다는 뜻이다. */
export type TocMode = 'auto' | 'inline' | 'floating' | false;

/** 목차를 어디에 그릴지. 둘 다 false 면 목차 마크업 자체를 내지 않는다. */
export interface TocPlacement {
  /** 글 머리의 접이식 목차. */
  readonly inline: boolean;
  /** 화면에 떠 있는 목차. `auto` 에서는 상단 목차가 보이지 않을 때만 나타난다. */
  readonly floating: boolean;
  /**
   * 플로팅 목차의 등장을 상단 목차의 위치에 맡기는가.
   *
   * `auto` 에서만 참이다. 이 경우 플로팅 목차는 처음에 숨겨진 채 나가고, 스크립트가
   * 상단 목차를 관찰해 보여 준다 — 스크립트가 없으면 상단 목차만 남는다.
   */
  readonly floatingFollowsScroll: boolean;
}

/**
 * `toc` 설정과 실제 목차 항목 수로 목차의 자리를 정한다.
 *
 * 설정이 무엇이든 **담을 항목이 없으면 아무것도 그리지 않는다**. 빈 목차 상자와
 * 눌러도 비어 있는 플로팅 버튼은 정보가 아니라 소음이다.
 */
export function resolveTocPlacement(mode: TocMode | undefined, entryCount: number): TocPlacement {
  const none = { inline: false, floating: false, floatingFollowsScroll: false } as const;
  if (mode === false || entryCount === 0) return none;

  // `undefined` 는 스키마 기본값이 아직 닿지 않은 항목이다. Astro 의 콘텐츠 저장소
  // (`node_modules/.astro/data-store.json`)는 **파일이 바뀔 때만** 다시 파싱해서, 스키마에
  // 필드를 새로 추가한 직후의 기존 글이 잠시 이 상태가 된다. 목차 배치는 글의 의미가 아니라
  // 표현이므로, 빌드를 세우는 대신 기본값으로 읽는다.
  switch (mode ?? 'auto') {
    case 'inline':
      return { inline: true, floating: false, floatingFollowsScroll: false };
    case 'floating':
      return { inline: false, floating: true, floatingFollowsScroll: false };
    case 'auto':
      return { inline: true, floating: true, floatingFollowsScroll: true };
  }
}
