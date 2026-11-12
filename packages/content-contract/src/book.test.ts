import { describe, expect, it } from 'vitest';
import { bookSchema, strictBookSchema, PUBLIC_BOOK_FIELDS, isBookId } from './index.js';

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
