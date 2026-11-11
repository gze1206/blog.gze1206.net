import { describe, expect, it } from 'vitest';
import { toRssItems } from './feed';

const publishedPost = {
  id: 'hello-world.md',
  data: {
    title: 'Hello World',
    description: '첫 글 요약입니다.',
    slug: 'hello-world',
    category: '개발',
    tags: ['Astro', '블로그', '개발'],
    publishedAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    draft: false,
  },
};

describe('toRssItems', () => {
  it('공개 글만 정규 URL·요약·분류 메타데이터로 변환한다', () => {
    const items = toRssItems(
      [
        publishedPost,
        {
          ...publishedPost,
          id: 'draft.md',
          data: { ...publishedPost.data, slug: 'draft', title: '초안', draft: true },
        },
      ],
      'https://gze1206.net',
    );

    expect(items).toEqual([
      {
        title: 'Hello World',
        description: '첫 글 요약입니다.',
        link: 'https://gze1206.net/blog/hello-world',
        pubDate: new Date('2026-08-01T00:00:00.000Z'),
        customData:
          '<category>개발</category><category>Astro</category><category>블로그</category>',
      },
    ]);
  });
});
