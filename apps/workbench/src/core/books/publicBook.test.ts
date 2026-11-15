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
  it('NOR-196 AC-10: 표지 파일과 공개 URL 은 책 id 로 정한다', () => {
    const result = planBookExport({
      record,
      current: null,
      cover: {
        workspacePath: 'assets/books/original.png',
        info: { src: 'ignored', width: 10, height: 20 },
      },
    });
    expect(result.kind).toBe('write');
    if (result.kind !== 'write') throw new Error('expected write');
    expect(result.cover).toEqual({
      from: 'assets/books/original.png',
      to: 'apps/blog/public/assets/books/책-제목.png',
    });
    expect(JSON.parse(result.content).cover.src).toBe(
      '/assets/books/%EC%B1%85-%EC%A0%9C%EB%AA%A9.png',
    );
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

describe('NOR-213 책 JSON 형식', () => {
  const book = {
    title: '니체의 초월자',
    authors: ['프리드리히 니체'],
    translators: ['김철'],
    publisher: '히읏',
    publishedYear: 2025,
    isbn13: '9791192559100',
    status: 'reading',
    startedAt: '2026-08-06',
    format: 'ebook',
    source: 'library',
    tags: ['철학', '고전', '독일', '근대 사상', '도덕 계보학', '권력 의지', '영원 회귀', '초인'],
    cover: {
      src: '/assets/books/니체의-초월자.jpg',
      width: 400,
      height: 600,
      source: 'Open Library',
    },
  };

  it('NOR-213 AC-2: 직렬화 결과는 저장소 Prettier 형식과 같다', async () => {
    const prettier = await import('prettier');
    const text = serializePublicBook(book as never);
    const formatted = await prettier.format(text, {
      parser: 'json',
      printWidth: 100,
      tabWidth: 2,
      trailingComma: 'all',
    });
    expect(text).toBe(formatted);
  });

  it('NOR-213 AC-3: 값이 같으면 기존 Prettier 형식 파일과 같은 글자다', () => {
    const existing = `{
  "title": "니체의 초월자",
  "authors": ["프리드리히 니체"],
  "status": "reading",
  "startedAt": "2026-08-06",
  "format": "ebook",
  "source": "library",
  "tags": ["철학"]
}
`;
    expect(
      serializePublicBook({
        title: '니체의 초월자',
        authors: ['프리드리히 니체'],
        status: 'reading',
        startedAt: '2026-08-06',
        format: 'ebook',
        source: 'library',
        tags: ['철학'],
      } as never),
    ).toBe(existing);
  });
});
