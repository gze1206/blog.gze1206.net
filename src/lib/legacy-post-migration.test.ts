import { describe, expect, it } from 'vitest';
import {
  assertLegacyPostMetadata,
  legacyDateToPostDates,
  normalizeLegacyPostBody,
} from './legacy-post-migration';

describe('normalizeLegacyPostBody', () => {
  it('removes excerpt markers, expands Nuxt line-break tokens, and converts file-name fences', () => {
    expect(
      normalizeLegacyPostBody('첫 문단\n<!--more-->\n:br\n```ruby[answer.rb]\nputs 1\n```'),
    ).toBe('첫 문단\n\n```ruby title="answer.rb"\nputs 1\n```');
  });
});

describe('legacyDateToPostDates', () => {
  it('uses the legacy publication date for both required collection dates', () => {
    expect(legacyDateToPostDates('2021-10-04T21:24:58.938Z')).toEqual({
      publishedAt: '2021-10-04T21:24:58.938Z',
      updatedAt: '2021-10-04T21:24:58.938Z',
    });
  });
});

describe('assertLegacyPostMetadata', () => {
  it('rejects an incomplete legacy article', () => {
    expect(() => assertLegacyPostMetadata({ title: '제목' } as never)).toThrow('slug');
  });

  it('rejects an article with no tags', () => {
    expect(() =>
      assertLegacyPostMetadata({
        title: '제목',
        slug: '제목',
        date: '2021-10-04T21:24:58.938Z',
        category: '개발',
        tags: [],
      }),
    ).toThrow('tags');
  });

  it.each(['title', 'date', 'category'] as const)('rejects an article missing %s', (field) => {
    const metadata = {
      title: '제목',
      slug: '제목',
      date: '2021-10-04T21:24:58.938Z',
      category: '개발',
      tags: ['tag'],
      [field]: undefined,
    };

    expect(() => assertLegacyPostMetadata(metadata as never)).toThrow(field);
  });
});
