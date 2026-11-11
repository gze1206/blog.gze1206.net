/**
 * 시리즈 내비게이션의 순수 로직 (NOR-18, ADR 0011).
 *
 * 목록·이전/다음·진행도 **셋을 한 배열 하나에서** 파생시킨다. 셋을 각자 계산하면
 * 화면 안에서 서로 어긋난다 — 특히 draft 가 시리즈 중간에 끼면 그렇다.
 *
 * ### 왜 `seriesOrder` 의 ±1 이 아닌가
 *
 * `seriesOrder` 는 저자가 손으로 매기는 번호다. 그중 draft 인 편은 프로덕션 빌드에
 * **페이지 자체가 없다**(ADR 0009). 1·2·3·4 중 3편이 draft 일 때 2편의 "다음 편"을
 * `seriesOrder + 1` 로 구하면 없는 페이지로 가는 링크(404)가 만들어진다.
 * 그래서 인접 관계도, 화면에 보이는 편 번호도 **노출 대상만 걸러낸 목록의 인덱스**로 구한다.
 *
 * 입력은 `getVisiblePosts()` 의 결과다 — draft 필터의 단일 지점(NOR-16). dev 서버에서는
 * draft 가 포함되므로 같은 글의 진행도가 프로덕션과 달라지는데, 그것은 입력이 다르기 때문이며
 * **한 페이지 안에서는 언제나 같은 배열 하나**에서 나온다.
 */

import { selectSeriesPosts, type PostLike } from './posts';

/**
 * 시리즈 목록을 펼친 채로 시작하는 최대 편수. 근거는 ADR 0011.
 *
 * 8줄은 본문 뒤 한 화면을 넘기지 않는다. 그보다 긴 시리즈의 목록을 본문 바로 뒤에 통째로
 * 펼치면 독자가 벽을 만나므로 접은 채로 시작한다. **잘라내지는 않는다** — 열면 전부 보인다.
 */
export const SERIES_LIST_EXPANDED_UNTIL = 8;

/** 시리즈 목록을 펼친 채로 렌더할 것인가(`<details open>`). */
export function shouldExpandSeriesList(total: number): boolean {
  return total <= SERIES_LIST_EXPANDED_UNTIL;
}

/** 시리즈 목록의 한 줄. `position` 은 `seriesOrder` 값이 아니라 노출 대상 목록에서의 순서다. */
export interface SeriesNavigationItem<T> {
  readonly post: T;
  /** 노출 대상 목록에서 몇 번째인가 (1부터). */
  readonly position: number;
  /** 지금 보고 있는 글인가. 목록에서 링크 대신 `aria-current` 로 표시할 대상. */
  readonly isCurrent: boolean;
}

/** 상세 페이지의 시리즈 블록이 그리는 데 필요한 전부. */
export interface SeriesNavigation<T> {
  /** 노출 대상만, `seriesOrder` 오름차순. `previous`/`next`/`position` 의 유일한 근거다. */
  readonly items: readonly SeriesNavigationItem<T>[];
  /** 노출 대상 편 수 (진행도의 분모). */
  readonly total: number;
  /** 현재 글의 위치 (진행도의 분자, 1부터). */
  readonly position: number;
  readonly previous: T | undefined;
  readonly next: T | undefined;
}

/**
 * 현재 글이 속한 시리즈의 내비게이션을 만든다.
 *
 * 렌더할 것이 없으면 `null` 을 돌려준다 — 호출부가 조건을 다시 판단하지 않도록 판단을 여기 모은다
 * (`buildToc` 가 헤딩 2개 미만에서 `[]` 를 돌려주는 것과 같은 이유다). `null` 인 경우:
 *
 * - 현재 글이 시리즈에 속하지 않는다.
 * - 현재 글이 노출 대상 목록에 없다(방어. 정상 흐름에서는 일어나지 않는다).
 * - 그 시리즈의 노출 대상이 1편뿐이다 — 이전/다음이 둘 다 없고, 시리즈 소속은 상세 헤더가
 *   이미 이름 + 링크로 알려준다. 남는 것이 중복뿐이라 블록을 만들지 않는다(ADR 0011).
 *
 * @param visiblePosts `getVisiblePosts()` 의 결과. 정렬 상태에 의존하지 않는다.
 * @param currentSlug 현재 글의 프론트매터 slug.
 */
export function buildSeriesNav<T extends PostLike>(
  visiblePosts: readonly T[],
  currentSlug: string,
): SeriesNavigation<T> | null {
  const current = visiblePosts.find((post) => post.data.slug === currentSlug);
  const seriesId = current?.data.series;
  if (current === undefined || seriesId === undefined) return null;

  const seriesPosts = selectSeriesPosts(visiblePosts, seriesId);
  if (seriesPosts.length < 2) return null;

  const index = seriesPosts.findIndex((post) => post.data.slug === currentSlug);
  if (index < 0) return null;

  return {
    items: seriesPosts.map((post, order) => ({
      post,
      position: order + 1,
      isCurrent: order === index,
    })),
    total: seriesPosts.length,
    position: index + 1,
    previous: seriesPosts[index - 1],
    next: seriesPosts[index + 1],
  };
}
