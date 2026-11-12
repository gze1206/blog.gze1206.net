import { describe, expect, it } from 'vitest';
import { buildArticleJsonLd, buildPersonJsonLd } from './json-ld';

describe('JSON-LD', () => {
  it('글의 작성·수정일과 저자를 BlogPosting으로 만든다', () => {
    expect(
      buildArticleJsonLd({
        title: '글',
        description: '설명',
        url: 'https://gze1206.net/blog/a',
        published: '2026-01-01T00:00:00.000Z',
        modified: '2026-01-02T00:00:00.000Z',
      }),
    ).toMatchObject({
      '@type': 'BlogPosting',
      datePublished: '2026-01-01T00:00:00.000Z',
      author: { name: 'gze1206' },
    });
  });

  it('About용 Person은 공개 소개와 URL만 담는다', () => {
    expect(buildPersonJsonLd('https://gze1206.net/')).toMatchObject({
      '@type': 'Person',
      name: 'gze1206',
      url: 'https://gze1206.net/',
    });
  });
});
