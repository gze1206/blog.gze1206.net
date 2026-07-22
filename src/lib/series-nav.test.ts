import { describe, expect, it } from 'vitest';
import { selectVisible, sortByPublishedDesc, type PostLike } from './posts';
import { buildSeriesNav, SERIES_LIST_EXPANDED_UNTIL, shouldExpandSeriesList } from './series-nav';

interface TestPost extends PostLike {
  readonly data: PostLike['data'] & { readonly title: string };
}

/**
 * `getVisiblePosts()` 가 돌려주는 모양을 흉내 낸다 — 발행일 내림차순이고, draft 는
 * 프로덕션에서 이미 빠져 있다. 시리즈 순서(`seriesOrder`)와 발행일 순서를 **일부러 어긋나게** 두어
 * `buildSeriesNav` 가 목록 순서에 기대지 않는다는 것을 드러낸다.
 */
function post(order: number, options: { draft?: boolean; series?: string | null } = {}) {
  // `series: null` 은 "시리즈에 속하지 않는 글"을 뜻한다. `undefined` 를 쓰면 기본값과 구분되지 않는다.
  const { draft = false, series = 'guide' } = options;
  return {
    id: `post-${order}.md`,
    data: {
      slug: `post-${order}`,
      title: `${order}편`,
      category: 'dev',
      tags: ['astro'],
      series: series ?? undefined,
      seriesOrder: series === null ? undefined : order,
      publishedAt: new Date(`2026-06-${String(order).padStart(2, '0')}T00:00:00.000Z`),
      draft,
    },
  } satisfies TestPost;
}

/** 프로덕션 빌드가 보는 목록(draft 제외). */
function production(posts: readonly TestPost[]): TestPost[] {
  return sortByPublishedDesc(selectVisible(posts, false));
}

/** dev 서버가 보는 목록(draft 포함). */
function development(posts: readonly TestPost[]): TestPost[] {
  return sortByPublishedDesc(selectVisible(posts, true));
}

const FOUR_PARTS = [post(1), post(2), post(3), post(4)];

describe('buildSeriesNav — 기본 동작', () => {
  it('중간 편은 앞뒤 편을 모두 가리킨다', () => {
    const nav = buildSeriesNav(production(FOUR_PARTS), 'post-2');

    expect(nav?.previous?.data.slug).toBe('post-1');
    expect(nav?.next?.data.slug).toBe('post-3');
    expect(nav?.position).toBe(2);
    expect(nav?.total).toBe(4);
  });

  it('첫 편에는 이전이 없다', () => {
    const nav = buildSeriesNav(production(FOUR_PARTS), 'post-1');

    expect(nav?.previous).toBeUndefined();
    expect(nav?.next?.data.slug).toBe('post-2');
    expect(nav?.position).toBe(1);
  });

  it('마지막 편에는 다음이 없다', () => {
    const nav = buildSeriesNav(production(FOUR_PARTS), 'post-4');

    expect(nav?.previous?.data.slug).toBe('post-3');
    expect(nav?.next).toBeUndefined();
    expect(nav?.position).toBe(4);
  });

  it('목록은 seriesOrder 오름차순이고 현재 글 하나만 isCurrent 다', () => {
    const nav = buildSeriesNav(production(FOUR_PARTS), 'post-3');

    expect(nav?.items.map((item) => item.post.data.slug)).toEqual([
      'post-1',
      'post-2',
      'post-3',
      'post-4',
    ]);
    expect(nav?.items.map((item) => item.position)).toEqual([1, 2, 3, 4]);
    expect(nav?.items.filter((item) => item.isCurrent).map((item) => item.post.data.slug)).toEqual([
      'post-3',
    ]);
  });

  it('이전/다음은 items 와 같은 목록에서 나온다 (기준이 하나다)', () => {
    const nav = buildSeriesNav(production(FOUR_PARTS), 'post-2');
    const slugs = nav?.items.map((item) => item.post.data.slug) ?? [];
    const index = (nav?.position ?? 0) - 1;

    expect(nav?.previous?.data.slug).toBe(slugs[index - 1]);
    expect(nav?.next?.data.slug).toBe(slugs[index + 1]);
  });

  it('다른 시리즈 글이 섞여 있어도 현재 글의 시리즈만 쓴다', () => {
    const others = [
      { ...post(1, { series: 'other' }), id: 'other-1.md' },
      { ...post(9, { series: null }), id: 'loner.md' },
    ];
    const nav = buildSeriesNav(production([...FOUR_PARTS, ...others]), 'post-2');

    expect(nav?.total).toBe(4);
    expect(nav?.items.every((item) => item.post.data.series === 'guide')).toBe(true);
  });
});

describe('buildSeriesNav — draft 가 시리즈 순서를 관통할 때', () => {
  it('중간 편이 draft 면 앞뒤가 서로를 가리킨다 (건너뛴다)', () => {
    const posts = [post(1), post(2), post(3, { draft: true }), post(4)];
    const nav = buildSeriesNav(production(posts), 'post-2');

    // seriesOrder 로 ±1 하면 존재하지 않는 3편(404)을 가리키게 된다.
    expect(nav?.next?.data.slug).toBe('post-4');
    expect(buildSeriesNav(production(posts), 'post-4')?.previous?.data.slug).toBe('post-2');
    expect(nav?.total).toBe(3);
    expect(nav?.position).toBe(2);
  });

  it('첫 편이 draft 면 그다음 편이 첫 편이 된다', () => {
    const posts = [post(1, { draft: true }), post(2), post(3), post(4)];
    const nav = buildSeriesNav(production(posts), 'post-2');

    expect(nav?.previous).toBeUndefined();
    expect(nav?.position).toBe(1);
    expect(nav?.total).toBe(3);
    expect(nav?.items.map((item) => item.post.data.slug)).toEqual(['post-2', 'post-3', 'post-4']);
  });

  it('마지막 편이 draft 면 직전 편이 마지막이 된다', () => {
    const posts = [post(1), post(2), post(3), post(4, { draft: true })];
    const nav = buildSeriesNav(production(posts), 'post-3');

    expect(nav?.next).toBeUndefined();
    expect(nav?.position).toBe(3);
    expect(nav?.total).toBe(3);
  });

  it('진행도의 분모는 원본 편 수가 아니라 노출 대상 편 수다', () => {
    const posts = [post(1), post(2, { draft: true }), post(3, { draft: true }), post(4)];

    expect(buildSeriesNav(production(posts), 'post-4')?.total).toBe(2);
  });

  it('같은 글이라도 dev(draft 포함) 입력에서는 진행도가 달라진다 — 의도된 차이', () => {
    const posts = [post(1), post(2), post(3, { draft: true }), post(4)];

    const built = buildSeriesNav(production(posts), 'post-4');
    const dev = buildSeriesNav(development(posts), 'post-4');

    expect([built?.position, built?.total]).toEqual([3, 3]);
    expect([dev?.position, dev?.total]).toEqual([4, 4]);
    expect(dev?.previous?.data.slug).toBe('post-3');
  });

  it('편 번호(position)는 seriesOrder 값이 아니라 목록 순서다', () => {
    // 저자가 1, 2, 5 처럼 띄엄띄엄 매긴 경우.
    const posts = [post(1), post(2), post(5)];
    const nav = buildSeriesNav(production(posts), 'post-5');

    expect(nav?.position).toBe(3);
    expect(nav?.items.map((item) => item.position)).toEqual([1, 2, 3]);
  });
});

describe('buildSeriesNav — 블록을 렌더하지 않는 경우', () => {
  it('시리즈에 속하지 않는 글이면 null', () => {
    const posts = [...FOUR_PARTS, { ...post(9, { series: null }), id: 'loner.md' }];

    expect(buildSeriesNav(production(posts), 'post-9')).toBeNull();
  });

  it('노출 대상이 1편뿐이면 null (이전/다음이 둘 다 없다)', () => {
    const posts = [post(1), post(2, { draft: true }), post(3, { draft: true })];

    expect(buildSeriesNav(production(posts), 'post-1')).toBeNull();
    // dev 에서는 3편이 모두 보이므로 블록이 생긴다.
    expect(buildSeriesNav(development(posts), 'post-1')?.total).toBe(3);
  });

  it('현재 글이 목록에 없으면 null (방어)', () => {
    expect(buildSeriesNav(production(FOUR_PARTS), 'unknown-slug')).toBeNull();
  });

  it('빈 목록이어도 터지지 않는다', () => {
    expect(buildSeriesNav([], 'post-1')).toBeNull();
  });
});

describe('shouldExpandSeriesList — 목록 분량 정책 (ADR 0011)', () => {
  it('경계값까지는 펼친 채로 시작한다', () => {
    expect(shouldExpandSeriesList(2)).toBe(true);
    expect(shouldExpandSeriesList(SERIES_LIST_EXPANDED_UNTIL)).toBe(true);
  });

  it('경계값을 넘으면 접은 채로 시작한다 — 본문 뒤에 벽을 만들지 않는다', () => {
    expect(shouldExpandSeriesList(SERIES_LIST_EXPANDED_UNTIL + 1)).toBe(false);
    expect(shouldExpandSeriesList(20)).toBe(false);
  });
});
