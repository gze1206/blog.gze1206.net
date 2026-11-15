import { describe, expect, it } from 'vitest';
import {
  ContentIntegrityError,
  assertPaginationSafeSlugs,
  assertSeriesIntegrity,
  assertUniquePostSlugs,
  assertUniqueSourceSlugs,
  groupByCategory,
  groupByTag,
  selectSeriesPosts,
  selectVisible,
  sortByPublishedDesc,
  type PostLike,
} from './posts';

interface PostOverrides {
  id?: string;
  slug?: string;
  category?: string;
  tags?: string[];
  series?: string;
  seriesOrder?: number;
  publishedAt?: string;
  draft?: boolean;
}

function post(overrides: PostOverrides = {}): PostLike {
  const slug = overrides.slug ?? 'post';
  return {
    id: overrides.id ?? `${slug}.md`,
    data: {
      slug,
      category: overrides.category ?? 'dev',
      tags: overrides.tags ?? ['astro'],
      series: overrides.series,
      seriesOrder: overrides.seriesOrder,
      publishedAt: new Date(overrides.publishedAt ?? '2026-01-01'),
      draft: overrides.draft ?? false,
    },
  };
}

describe('selectVisible', () => {
  const posts = [post({ slug: 'a' }), post({ slug: 'b', draft: true }), post({ slug: 'c' })];

  it('기본적으로 draft 를 제외한다', () => {
    expect(selectVisible(posts, false).map((p) => p.data.slug)).toEqual(['a', 'c']);
  });

  it('includeDrafts 면 draft 도 남긴다', () => {
    expect(selectVisible(posts, true).map((p) => p.data.slug)).toEqual(['a', 'b', 'c']);
  });

  it('입력 배열을 변형하지 않는다', () => {
    const input = [...posts];
    selectVisible(input, false);
    expect(input).toHaveLength(3);
  });
});

describe('sortByPublishedDesc', () => {
  it('publishedAt 내림차순으로 정렬한다', () => {
    const sorted = sortByPublishedDesc([
      post({ slug: 'old', publishedAt: '2026-01-01' }),
      post({ slug: 'new', publishedAt: '2026-03-01' }),
      post({ slug: 'mid', publishedAt: '2026-02-01' }),
    ]);
    expect(sorted.map((p) => p.data.slug)).toEqual(['new', 'mid', 'old']);
  });

  it('같은 날짜는 slug 오름차순으로 고정한다 (빌드 결정성)', () => {
    const sorted = sortByPublishedDesc([
      post({ slug: 'zebra', publishedAt: '2026-01-01' }),
      post({ slug: 'apple', publishedAt: '2026-01-01' }),
    ]);
    expect(sorted.map((p) => p.data.slug)).toEqual(['apple', 'zebra']);
  });
});

describe('assertUniqueSourceSlugs', () => {
  function source(slug: string, extra = ''): string {
    return `---\ntitle: '제목'\nslug: ${slug}\ncategory: 'dev'\n${extra}---\n\n본문\n`;
  }

  it('중복이 없으면 통과한다', () => {
    expect(() =>
      assertUniqueSourceSlugs({
        'a.md': source(`'alpha'`),
        'b.mdoc': source(`"beta"`),
        'c.md': source('gamma'),
      }),
    ).not.toThrow();
  });

  it('파일이 달라도 slug 가 같으면 실패한다 (로더가 조용히 덮어쓴다)', () => {
    expect(() =>
      assertUniqueSourceSlugs({
        'hello-world.md': source(`'hello-world'`),
        'another.md': source(`'hello-world'`),
      }),
    ).toThrow(/slug 중복/);
  });

  it('중복 메시지에 양쪽 파일 경로가 들어간다', () => {
    expect(() =>
      assertUniqueSourceSlugs({ 'a.md': source(`'dup'`), 'b.md': source(`'dup'`) }),
    ).toThrow(/a\.md.*b\.md/s);
  });

  it('slug 줄이 없거나 읽을 수 없으면 실패한다', () => {
    expect(() => assertUniqueSourceSlugs({ 'a.md': `---\ntitle: '제목'\n---\n본문\n` })).toThrow(
      /slug 를 읽지 못했습니다/,
    );
    expect(() => assertUniqueSourceSlugs({ 'a.md': '프론트매터가 없는 파일' })).toThrow(
      ContentIntegrityError,
    );
  });

  it('본문에 나오는 slug 문자열에 속지 않는다', () => {
    // 프론트매터 블록 안만 본다.
    const body = `---\ntitle: '제목'\nslug: 'real'\n---\n\nslug: 'fake'\n`;
    expect(() => assertUniqueSourceSlugs({ 'a.md': body, 'b.md': source(`'fake'`) })).not.toThrow();
  });

  it('주석이 붙은 slug 도 읽는다', () => {
    expect(() =>
      assertUniqueSourceSlugs({
        'a.md': `---\nslug: alpha # 임시\n---\n`,
        'b.md': `---\nslug: 'alpha'\n---\n`,
      }),
    ).toThrow(/slug 중복/);
  });
});

describe('assertUniquePostSlugs', () => {
  it('중복이 없으면 통과한다', () => {
    expect(() => assertUniquePostSlugs([post({ slug: 'a' }), post({ slug: 'b' })])).not.toThrow();
  });

  it('slug 가 중복되면 실패한다', () => {
    expect(() =>
      assertUniquePostSlugs([
        post({ id: 'first.md', slug: 'dup' }),
        post({ id: 'second.mdoc', slug: 'dup' }),
      ]),
    ).toThrow(ContentIntegrityError);
  });

  it('draft 글도 검사 대상이다', () => {
    expect(() =>
      assertUniquePostSlugs([
        post({ id: 'first.md', slug: 'dup' }),
        post({ id: 'second.md', slug: 'dup', draft: true }),
      ]),
    ).toThrow(/slug 중복/);
  });
});

describe('assertPaginationSafeSlugs', () => {
  it('숫자만으로 된 slug 는 페이지네이션 경로와 충돌하므로 실패한다', () => {
    expect(() => assertPaginationSafeSlugs([post({ slug: '2' })])).toThrow(ContentIntegrityError);
  });

  it('숫자를 포함하기만 하는 slug 는 허용한다', () => {
    expect(() =>
      assertPaginationSafeSlugs([post({ slug: 'astro-5-release' }), post({ slug: 'v2-notes' })]),
    ).not.toThrow();
  });
});

describe('groupByCategory / groupByTag', () => {
  it('표시 원문을 보존하면서 슬러그로 묶는다', () => {
    const groups = groupByCategory([
      post({ slug: 'a', category: '웹 성능' }),
      post({ slug: 'b', category: '웹 성능' }),
      post({ slug: 'c', category: 'dev' }),
    ]);
    const perf = groups.find((g) => g.slug === '웹-성능');
    expect(perf?.label).toBe('웹 성능');
    expect(perf?.posts.map((p) => p.data.slug)).toEqual(['a', 'b']);
    expect(groups.map((g) => g.slug)).toContain('dev');
  });

  it('태그는 글 하나가 여러 그룹에 들어간다', () => {
    const groups = groupByTag([
      post({ slug: 'a', tags: ['astro', 'typescript'] }),
      post({ slug: 'b', tags: ['astro'] }),
    ]);
    expect(groups.find((g) => g.slug === 'astro')?.posts).toHaveLength(2);
    expect(groups.find((g) => g.slug === 'typescript')?.posts).toHaveLength(1);
  });

  it('같은 글이 같은 태그를 중복 기재해도 한 번만 센다', () => {
    const groups = groupByTag([post({ slug: 'a', tags: ['astro', 'astro'] })]);
    expect(groups.find((g) => g.slug === 'astro')?.posts).toHaveLength(1);
  });

  it('표시 문자열이 다른데 슬러그가 같으면 실패한다 (조용한 병합 금지)', () => {
    expect(() =>
      groupByTag([
        post({ slug: 'a', tags: ['TypeScript'] }),
        post({ slug: 'b', tags: ['typescript'] }),
      ]),
    ).toThrow(/슬러그 충돌/);

    expect(() =>
      groupByCategory([
        post({ slug: 'a', category: 'Web Performance' }),
        post({ slug: 'b', category: 'web performance' }),
      ]),
    ).toThrow(ContentIntegrityError);
  });

  it('빈 입력이면 빈 배열이다', () => {
    expect(groupByCategory([])).toEqual([]);
    expect(groupByTag([])).toEqual([]);
  });
});

describe('assertSeriesIntegrity', () => {
  const known = new Set(['astro-guide']);

  it('정상 참조는 통과한다', () => {
    expect(() =>
      assertSeriesIntegrity(
        [
          post({ slug: 'a', series: 'astro-guide', seriesOrder: 1 }),
          post({ slug: 'b', series: 'astro-guide', seriesOrder: 2 }),
          post({ slug: 'c' }),
        ],
        known,
      ),
    ).not.toThrow();
  });

  it('존재하지 않는 시리즈를 가리키면 실패한다', () => {
    expect(() =>
      assertSeriesIntegrity([post({ slug: 'a', series: 'astro-guid', seriesOrder: 1 })], known),
    ).toThrow(/존재하지 않는 시리즈/);
  });

  it('같은 시리즈 안에서 seriesOrder 가 겹치면 실패한다', () => {
    expect(() =>
      assertSeriesIntegrity(
        [
          post({ id: 'a.md', slug: 'a', series: 'astro-guide', seriesOrder: 1 }),
          post({ id: 'b.md', slug: 'b', series: 'astro-guide', seriesOrder: 1 }),
        ],
        known,
      ),
    ).toThrow(/seriesOrder 1 가 중복/);
  });

  it('draft 글도 검사 대상이다 (dev 에서만 터지는 오류를 막는다)', () => {
    expect(() =>
      assertSeriesIntegrity(
        [post({ slug: 'a', series: 'nope', seriesOrder: 1, draft: true })],
        known,
      ),
    ).toThrow(ContentIntegrityError);
  });
});

describe('selectSeriesPosts', () => {
  it('해당 시리즈 글만 seriesOrder 오름차순으로 반환한다', () => {
    const posts = [
      post({ slug: 'third', series: 'astro-guide', seriesOrder: 3 }),
      post({ slug: 'other', series: 'other-series', seriesOrder: 1 }),
      post({ slug: 'first', series: 'astro-guide', seriesOrder: 1 }),
      post({ slug: 'plain' }),
    ];
    expect(selectSeriesPosts(posts, 'astro-guide').map((p) => p.data.slug)).toEqual([
      'first',
      'third',
    ]);
  });

  it('글이 없는 시리즈는 빈 배열이다', () => {
    expect(selectSeriesPosts([post({ slug: 'a' })], 'astro-guide')).toEqual([]);
  });
});
