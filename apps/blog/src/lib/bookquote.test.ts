import { bookquoteTag } from '@gze1206/content-contract';
import { describe, expect, it } from 'vitest';
import config from '../../markdoc.config.mjs';
import * as bookquote from './bookquote';
import { formatBookquoteCaption } from './bookquote';

it('NOR-196 AC-6: 블로그 bookquote 태그 속성은 계약의 bookquoteTag 와 같다', () => {
  expect(config.tags?.bookquote?.attributes).toBe(bookquoteTag.attributes);
});
describe('NOR-196 AC-7: 책 인용 출처', () => {
  it('저자·역자·쪽수와 책장 링크를 표시한다', () => {
    expect(
      formatBookquoteCaption(
        {
          book: '책',
          title: '제목',
          authors: ['가', '나'],
          translators: ['다', '라'],
          publisher: '출판사',
          year: 2020,
          page: 42,
        },
        new Set(['책']),
      ),
    ).toEqual({
      authors: '가, 나',
      title: '『제목』',
      translators: '다, 라 옮김',
      publisher: '출판사',
      year: '2020',
      page: 'p. 42',
      href: '/books#%EC%B1%85',
    });
  });
  it('선택 출처와 책장 링크가 없을 수 있다', () => {
    expect(
      formatBookquoteCaption(
        { book: '없음', title: '제목', authors: ['가'], translators: [] },
        new Set(),
      ),
    ).toEqual({ authors: '가', title: '『제목』' });
  });
});

it('NOR-196 AC-7: figcaption 은 저자, 『제목』, 역자, 출판사, 연도, 쪽수 순서다', () => {
  expect(bookquote).toHaveProperty('captionSegments');
  const { captionSegments } = bookquote as unknown as {
    captionSegments: (caption: bookquote.BookquoteCaption) => string[];
  };
  const caption = formatBookquoteCaption(
    {
      book: '책',
      title: '제목',
      authors: ['가'],
      translators: ['나'],
      publisher: '출판사',
      year: 2020,
      page: 42,
    },
    new Set(),
  );
  expect(captionSegments(caption)).toEqual([
    '가',
    '『제목』',
    '나 옮김',
    '출판사',
    '2020',
    'p. 42',
  ]);
  expect(
    captionSegments(
      formatBookquoteCaption(
        { book: '책', title: '제목', authors: ['가'], translators: [] },
        new Set(),
      ),
    ),
  ).toEqual(['가', '『제목』']);
});
