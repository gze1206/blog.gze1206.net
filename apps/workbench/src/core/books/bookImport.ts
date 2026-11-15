import { bookSchema, isBookId } from '@gze1206/content-contract';
import type { BookDocument } from '../document/document.js';

export function planBookImport(
  id: string,
  json: unknown,
): { path: string; document: BookDocument } {
  if (!isBookId(id)) throw new Error('invalid book id');
  const book = bookSchema.parse(json);
  const { cover: _cover, startedAt, finishedAt, quotes, ...fields } = book;
  const date =
    startedAt?.toISOString().slice(0, 10) ?? finishedAt?.toISOString().slice(0, 10) ?? '1970-01-01';
  return {
    path: `books/${id}.md`,
    document: {
      ...fields,
      kind: 'book',
      createdAt: date,
      updatedAt: date,
      content: '',
      extra: {},
      ...(startedAt === undefined ? {} : { startedAt: startedAt.toISOString().slice(0, 10) }),
      ...(finishedAt === undefined ? {} : { finishedAt: finishedAt.toISOString().slice(0, 10) }),
      // 블로그의 공개 구절은 워크벤치에서 공개로 켠 구절로 돌아온다(NOR-215).
      ...(quotes.length === 0
        ? {}
        : {
            excerpts: quotes.map((quote) => ({
              id: quote.id,
              text: quote.text,
              public: true,
              ...(quote.page === undefined ? {} : { page: quote.page }),
              ...(quote.memo === undefined ? {} : { memo: quote.memo }),
            })),
          }),
    },
  };
}
