import { bookSchema, isBookId } from '@gze1206/content-contract';
import type { BookDocument } from '../document/document.js';

export function planBookImport(
  id: string,
  json: unknown,
): { path: string; document: BookDocument } {
  if (!isBookId(id)) throw new Error('invalid book id');
  const book = bookSchema.parse(json);
  const { cover: _cover, startedAt, finishedAt, ...fields } = book;
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
    },
  };
}
