import { describe, expect, it } from 'vitest';
import { PUBLIC_BOOK_FIELDS, strictBookSchema } from '@gze1206/content-contract';
import { bookIdOf, planBookExport, serializePublicBook, toPublicBook } from './publicBook.js';
import { planBookImport } from './bookImport.js';
import type { WorkbenchDocument } from '../document/document.js';

const record: WorkbenchDocument = {
  title: '책 제목',
  kind: 'book',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  authors: ['저자'],
  status: 'reading',
  format: 'ebook',
  source: 'library',
  startedAt: '2026-01-01',
  excerpts: [{ text: '비공개 구절', memo: '비공개' }],
  memos: [{ text: '비공개 메모' }],
  content: '비공개 본문',
  extra: { secret: '비밀' },
};

describe('책 공개 변환', () => {
  it('NOR-196 AC-10: excerpts·memos·본문을 채워도 toPublicBook 출력에는 허용 목록 키만 있다', () => {
    const book = toPublicBook(record);
    expect(
      Object.keys(book).every((key) => PUBLIC_BOOK_FIELDS.includes(key as keyof typeof book)),
    ).toBe(true);
    expect(JSON.stringify(book)).not.toMatch(/비공개|비밀/);
    expect(bookIdOf(record)).toBe('책-제목');
  });
  it('NOR-196 AC-10: 출력은 strictBookSchema 를 통과한다', () => {
    expect(strictBookSchema.safeParse(toPublicBook(record)).success).toBe(true);
    expect(JSON.parse(serializePublicBook(toPublicBook(record))).startedAt).toBe('2026-01-01');
  });
  it('NOR-196 AC-10: visible false 면 파일이 있으면 지우고 없으면 아무것도 하지 않는다', () => {
    const input = { ...record, visible: false };
    expect(planBookExport({ record: input, current: '{}' }).kind).toBe('delete');
    expect(planBookExport({ record: input, current: null }).kind).toBe('noop');
    const write = planBookExport({ record, current: null });
    expect(write.kind).toBe('write');
    if (write.kind === 'write')
      expect(planBookExport({ record, current: write.content }).kind).toBe('noop');
  });
  it('NOR-196 AC-15: 블로그 책을 가져와 다시 내보내면 표지를 빼고 같은 값이다', () => {
    const original = {
      title: '책',
      authors: ['저자'],
      status: 'finished',
      format: 'paper',
      source: 'purchase',
      startedAt: '2026-01-01',
      finishedAt: '2026-01-02',
      cover: { src: '/assets/books/x.png', width: 10, height: 20 },
    };
    const { path, document } = planBookImport('책', original);
    expect(path).toBe('books/책.md');
    const { cover: _cover, ...expected } = strictBookSchema.parse(original);
    expect(toPublicBook(document)).toEqual(expected);
  });
});
