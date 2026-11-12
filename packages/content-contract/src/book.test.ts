import { describe, expect, it } from 'vitest';
import { bookSchema, strictBookSchema, PUBLIC_BOOK_FIELDS, isBookId } from './index.ts';

describe('book contract', () => {
  it('NOR-196 AC-2: PUBLIC_BOOK_FIELDS 는 bookSchema 키와 같고 비공개 키를 담지 않는다', () => {
    expect([...PUBLIC_BOOK_FIELDS].sort()).toEqual(Object.keys(bookSchema.shape).sort());
    expect(PUBLIC_BOOK_FIELDS).not.toContain('visible');
    expect(
      strictBookSchema.safeParse({
        title: 'a',
        authors: ['b'],
        status: 'want',
        format: 'paper',
        source: 'library',
        memo: 'secret',
      }).success,
    ).toBe(false);
  });
  it('NOR-196 AC-4: isBookId 는 13자리 ISBN 과 bookSlug 를 받고 공백·경로 문자를 거부한다', () => {
    for (const id of ['9788901234567', '니체의-초월자']) expect(isBookId(id)).toBe(true);
    for (const id of ['', 'a b', '../a', 'a/b', 'a\\b', 'a?b', 'a'.repeat(61)])
      expect(isBookId(id)).toBe(false);
  });
});

describe('bookSchema', () => {
  const validBook = {
    title: '니체의 초월자',
    authors: ['프리드리히 니체'],
    status: 'reading',
    format: 'ebook',
    source: 'library',
  };

  it('제목·저자·상태·형태·경로만 있으면 성립한다', () => {
    const parsed = bookSchema.parse(validBook);

    expect(parsed.tags).toEqual([]);
    expect(parsed.translators).toEqual([]);
  });

  it('저자가 없으면 실패한다', () => {
    expect(bookSchema.safeParse({ ...validBook, authors: [] }).success).toBe(false);
  });

  it('모르는 상태·형태는 받지 않는다', () => {
    expect(bookSchema.safeParse({ ...validBook, status: 'skimmed' }).success).toBe(false);
    expect(bookSchema.safeParse({ ...validBook, format: 'pdf' }).success).toBe(false);
  });

  it('ISBN13 은 숫자 13자리만 받는다', () => {
    expect(bookSchema.safeParse({ ...validBook, isbn13: '9788901234567' }).success).toBe(true);
    expect(bookSchema.safeParse({ ...validBook, isbn13: '978-89-0123-456-7' }).success).toBe(false);
  });

  it('표지는 크기를 함께 요구한다', () => {
    expect(
      bookSchema.safeParse({
        ...validBook,
        cover: { src: '/img/books/a.webp', width: 400, height: 600 },
      }).success,
    ).toBe(true);
    expect(
      bookSchema.safeParse({ ...validBook, cover: { src: '/img/books/a.webp' } }).success,
    ).toBe(false);
  });

  it('별점은 1~5 정수만 받는다', () => {
    expect(bookSchema.safeParse({ ...validBook, rating: 5 }).success).toBe(true);
    expect(bookSchema.safeParse({ ...validBook, rating: 6 }).success).toBe(false);
    expect(bookSchema.safeParse({ ...validBook, rating: 3.5 }).success).toBe(false);
  });
});
