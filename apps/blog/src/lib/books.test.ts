import { describe, expect, it } from 'vitest';
import { bookYear, groupBooksByYear, selectVisibleBooks, type BookLike } from './books';

function book(
  id: string,
  data: Partial<BookLike['data']> & Pick<BookLike['data'], 'status'>,
): BookLike {
  return {
    id,
    data: { title: id, visible: true, ...data },
  };
}

describe('selectVisibleBooks', () => {
  it('감춘 책은 목록에서 뺀다', () => {
    const books = [
      book('공개', { status: 'finished', visible: true }),
      book('비공개', { status: 'finished', visible: false }),
    ];

    expect(selectVisibleBooks(books).map((entry) => entry.id)).toEqual(['공개']);
  });

  it('읽는 중인 책이 먼저, 그다음은 최근에 손을 뗀 것부터', () => {
    const books = [
      book('작년완독', { status: 'finished', finishedAt: new Date('2025-01-01') }),
      book('읽는중', { status: 'reading', startedAt: new Date('2020-01-01') }),
      book('올해완독', { status: 'finished', finishedAt: new Date('2026-05-01') }),
      book('중단', { status: 'abandoned', finishedAt: new Date('2026-06-01') }),
    ];

    expect(selectVisibleBooks(books).map((entry) => entry.id)).toEqual([
      '읽는중',
      '올해완독',
      '작년완독',
      '중단',
    ]);
  });

  it('날짜가 없는 책은 같은 상태의 뒤로, 그 안에서는 제목순으로 둔다', () => {
    const books = [
      book('나중', { status: 'want' }),
      book('가운데', { status: 'want' }),
      book('날짜있음', { status: 'want', startedAt: new Date('2026-01-01') }),
    ];

    expect(selectVisibleBooks(books).map((entry) => entry.id)).toEqual([
      '날짜있음',
      '가운데',
      '나중',
    ]);
  });
});

describe('bookYear', () => {
  it('다 읽은 해로 센다', () => {
    expect(
      bookYear(
        book('a', {
          status: 'finished',
          startedAt: new Date('2025-12-20'),
          finishedAt: new Date('2026-01-05'),
        }),
      ),
    ).toBe(2026);
  });

  it('다 읽은 해가 없으면 시작한 해로 센다', () => {
    expect(bookYear(book('a', { status: 'reading', startedAt: new Date('2026-08-06') }))).toBe(
      2026,
    );
  });

  it('날짜가 하나도 없으면 연도를 정하지 않는다', () => {
    expect(bookYear(book('a', { status: 'want' }))).toBeNull();
  });
});

describe('groupBooksByYear', () => {
  it('최근 연도부터 묶고, 연도 미상은 맨 뒤에 둔다', () => {
    const books = [
      book('2024', { status: 'finished', finishedAt: new Date('2024-03-01') }),
      book('미상', { status: 'want' }),
      book('2026', { status: 'finished', finishedAt: new Date('2026-03-01') }),
    ];

    expect(groupBooksByYear(books).map((group) => group.year)).toEqual([2026, 2024, null]);
  });

  it('감춘 책은 그룹에도 들어가지 않는다', () => {
    const books = [book('비공개', { status: 'finished', visible: false })];

    expect(groupBooksByYear(books)).toEqual([]);
  });
});
