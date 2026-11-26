import { describe, expect, it } from 'vitest';
import { buildOgTargets, type OgTargetsInput } from './og-targets';
import { ogImagePath } from './routes';

function input(overrides: Partial<OgTargetsInput> = {}): OgTargetsInput {
  return {
    brand: 'gze1206.net',
    siteDescription: '개인 블로그',
    posts: [{ slug: 'hello-world', title: '첫 글' }],
    blogPageCount: 1,
    categories: [{ slug: 'dev', label: '개발', count: 2 }],
    tags: [{ slug: 'astro', label: 'Astro', count: 1 }],
    seriesList: [{ slug: 'astro-guide', name: 'Astro 가이드', description: '연재' }],
    ...overrides,
  };
}

function paths(targets: { path: string }[]): string[] {
  return targets.map((target) => target.path);
}

describe('buildOgTargets', () => {
  it('홈·목록·분류 인덱스를 모두 포함한다', () => {
    expect(paths(buildOgTargets(input()))).toEqual(
      expect.arrayContaining([
        '/og/index.png',
        '/og/blog.png',
        '/og/category.png',
        '/og/tags.png',
        '/og/topics.png',
        '/og/series.png',
      ]),
    );
  });

  it('경로는 `ogImagePath` 규칙을 그대로 따른다 (메타와 같은 값)', () => {
    for (const target of buildOgTargets(input())) {
      expect(target.path).toBe(ogImagePath(target.path.slice(3, -4)));
    }
  });

  it('NOR-223 AC-4: 파라미터는 디코딩된 값이고, 태그 카드는 # 없이 아이콘을 쓴다', () => {
    const targets = buildOgTargets(
      input({ tags: [{ slug: '웹-성능', label: '웹 성능', count: 1 }] }),
    );
    const tag = targets.find((target) => target.card.title === '웹 성능');
    expect(tag).toBeDefined();
    expect(tag?.card).toHaveProperty('icon', 'tag');
    expect(tag?.param).toBe('tags/웹-성능');
    expect(tag?.path).toBe(`/og/tags/${encodeURIComponent('웹-성능')}.png`);
  });

  it('글마다 카드가 하나씩 생긴다', () => {
    const targets = buildOgTargets(
      input({
        posts: [
          { slug: 'a', title: 'A' },
          { slug: 'b', title: 'B', seriesName: 'Astro 가이드' },
        ],
      }),
    );
    expect(paths(targets)).toEqual(expect.arrayContaining(['/og/blog/a.png', '/og/blog/b.png']));
    const withSeries = targets.find((target) => target.path === '/og/blog/b.png');
    expect(withSeries?.card).toMatchObject({
      kind: 'post',
      title: 'B',
      eyebrow: '시리즈 · Astro 가이드',
    });
  });

  it('시리즈가 없는 글은 라벨이 없다', () => {
    const target = buildOgTargets(input()).find((t) => t.path === '/og/blog/hello-world.png');
    expect(target?.card.eyebrow).toBeUndefined();
  });

  it('페이지네이션은 2페이지부터 만든다 (`/blog/1` 은 없다)', () => {
    const targets = buildOgTargets(input({ blogPageCount: 3 }));
    expect(paths(targets)).toEqual(expect.arrayContaining(['/og/blog/2.png', '/og/blog/3.png']));
    expect(paths(targets)).not.toContain('/og/blog/1.png');
  });

  it('분류 페이지는 라벨과 제목을 나눠 담는다', () => {
    const targets = buildOgTargets(input());
    expect(targets.find((t) => t.path === '/og/category/dev.png')?.card).toMatchObject({
      kind: 'list',
      eyebrow: '카테고리',
      title: '개발',
    });
    expect(targets.find((t) => t.path === '/og/series/astro-guide.png')?.card).toMatchObject({
      kind: 'list',
      eyebrow: '시리즈',
      title: 'Astro 가이드',
    });
  });

  it('경로가 겹치는 카드는 없다', () => {
    const list = paths(buildOgTargets(input({ blogPageCount: 4 })));
    expect(new Set(list).size).toBe(list.length);
  });

  it('브랜드는 호출부가 넘긴 값 하나뿐이다', () => {
    for (const target of buildOgTargets(input({ brand: 'example.com' }))) {
      expect(target.card.brand).toBe('example.com');
    }
  });

  it('글이 하나도 없어도 목록 카드는 만든다', () => {
    const targets = buildOgTargets(
      input({ posts: [], categories: [], tags: [], seriesList: [], blogPageCount: 1 }),
    );
    expect(paths(targets)).toEqual([
      '/og/index.png',
      '/og/blog.png',
      '/og/category.png',
      '/og/tags.png',
      '/og/topics.png',
      '/og/series.png',
      '/og/about.png',
      '/og/books.png',
      '/og/portfolio.png',
      '/og/privacy.png',
    ]);
  });
});

it('NOR-197 AC-5: 소개·책·포트폴리오 OG 대상을 만든다', () => {
  const targets = buildOgTargets(input());
  expect(paths(targets)).toEqual(
    expect.arrayContaining(['/og/about.png', '/og/books.png', '/og/portfolio.png']),
  );
  expect(targets.find((target) => target.path === '/og/about.png')?.card.kind).toBe('about');
});

it('NOR-216 AC-4: 책 상세 페이지마다 OG 타깃이 있다', () => {
  const targets = buildOgTargets({
    ...input(),
    books: [{ id: '니체의-초월자', title: '니체의 초월자', authors: ['프리드리히 니체'] }],
  } as OgTargetsInput);
  // 페이지 메타와 같은 인코딩된 경로다(태그와 같은 규칙).
  expect(paths(targets)).toContain(ogImagePath(`/books/${encodeURIComponent('니체의-초월자')}`));
});

it('NOR-250 AC-5: 영어 첫 화면·목록·글 카드를 영어 경로로 만든다', () => {
  const targets = buildOgTargets(
    input({ en: { posts: [{ slug: 'hello-world', title: 'Hello' }], blogPageCount: 2 } }),
  );
  expect(targets.map((target) => target.path)).toEqual(
    expect.arrayContaining([
      '/og/en.png',
      '/og/en/blog.png',
      '/og/en/blog/2.png',
      '/og/en/blog/hello-world.png',
      '/og/blog/hello-world.png',
    ]),
  );
  const card = targets.find((target) => target.path === '/og/en/blog.png')?.card;
  expect(card?.title).toBe('Blog');
});
