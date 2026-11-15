import {
  BLOG_LAYOUT,
  isBookId,
  PUBLIC_BOOK_FIELDS,
  strictBookSchema,
  type PublicBook,
} from '@gze1206/content-contract';
import type { BookDocument } from '../document/document.js';
import { bookSlug } from './metadata.js';

export interface PublicCover {
  src: string;
  width: number;
  height: number;
  source?: string;
}
export function bookIdOf(record: { title: string; isbn13?: string | undefined }): string {
  const id = record.isbn13 ?? bookSlug(record.title);
  if (!isBookId(id)) throw new Error('invalid book id');
  return id;
}
export function toPublicBook(record: BookDocument, cover?: PublicCover): PublicBook {
  const values: Record<string, unknown> = {};
  for (const key of PUBLIC_BOOK_FIELDS) {
    const value = key === 'cover' ? cover : record[key];
    if (value !== undefined) values[key] = value;
  }
  return strictBookSchema.parse(values);
}
export function serializePublicBook(book: PublicBook): string {
  const ordered: Record<string, unknown> = {};
  for (const key of PUBLIC_BOOK_FIELDS) {
    const value = book[key];
    if (value !== undefined)
      ordered[key] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
export type BookExportPlan =
  | { kind: 'write'; path: string; content: string; cover?: { from: string; to: string } }
  | { kind: 'delete'; path: string }
  | { kind: 'noop'; path: string };
export function planBookExport(input: {
  record: BookDocument;
  current: string | null;
  cover?: { workspacePath: string; info: PublicCover };
}): BookExportPlan {
  const id = bookIdOf(input.record);
  const path = `${BLOG_LAYOUT.booksDir}/${id}.json`;
  if (input.record.visible === false)
    return { kind: input.current === null ? 'noop' : 'delete', path };
  let info: PublicCover | undefined;
  let cover: { from: string; to: string } | undefined;
  if (input.cover !== undefined) {
    const match = /\.(jpe?g|png|webp)$/iu.exec(input.cover.workspacePath);
    if (!match?.[1]) throw new Error('invalid cover extension');
    const ext = match[1].toLowerCase();
    info = {
      ...input.cover.info,
      src: `${BLOG_LAYOUT.bookCoverUrlPrefix}/${encodeURIComponent(id)}.${ext}`,
    };
    cover = { from: input.cover.workspacePath, to: `${BLOG_LAYOUT.bookCoversDir}/${id}.${ext}` };
  }
  const content = serializePublicBook(toPublicBook(input.record, info));
  if (content === input.current) return { kind: 'noop', path };
  return { kind: 'write', path, content, ...(cover === undefined ? {} : { cover }) };
}
