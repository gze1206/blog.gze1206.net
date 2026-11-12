import { expect, it } from 'vitest';
import { bookStatusLabel, bookFormatLabel } from './book-labels';

it('NOR-197 AC-10: 책 상태와 형식을 한국어로 표시한다', () => {
  expect(bookStatusLabel('reading')).toBe('읽는 중');
  expect(bookFormatLabel('ebook')).toBe('전자책');
});
