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
    const value = key === 'cover' ? cover : key === 'quotes' ? publicQuotes(record) : record[key];
    if (value !== undefined) values[key] = value;
  }
  return strictBookSchema.parse(values);
}
export function serializePublicBook(book: PublicBook): string {
  const ordered: Record<string, unknown> = {};
  for (const key of PUBLIC_BOOK_FIELDS) {
    const value = book[key];
    // 공개 구절이 없으면 키를 쓰지 않는다. 모든 책 파일에 빈 배열이 생기지 않게 한다.
    if (key === 'quotes' && Array.isArray(value) && value.length === 0) continue;
    if (value !== undefined)
      ordered[key] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  }
  return `${formatJson(ordered, 0)}\n`;
}

const PRINT_WIDTH = 100;

/**
 * 저장소 Prettier(json, printWidth 100)와 같은 모양으로 쓴다 (NOR-213). 객체는 펼치고, 배열은 한 줄에
 * 들어가면 한 줄로 쓴다. 블로그 CI 의 format:check 를 통과해야 자동 병합(NOR-210)이 된다.
 */
function formatJson(value: unknown, indent: number, prefix = ''): string {
  const pad = ' '.repeat(indent);
  const inner = ' '.repeat(indent + 2);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => formatJson(item, indent + 2));
    const inline = `[${items.join(', ')}]`;
    if (
      !items.some((item) => item.includes('\n')) &&
      pad.length + prefix.length + inline.length + 1 <= PRINT_WIDTH
    )
      return inline;
    return `[\n${items.map((item) => `${inner}${item}`).join(',\n')}\n${pad}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    if (entries.length === 0) return '{}';
    return `{\n${entries
      .map(([key, item]) => {
        const head = `${JSON.stringify(key)}: `;
        return `${inner}${head}${formatJson(item, indent + 2, head)}`;
      })
      .join(',\n')}\n${pad}}`;
  }
  return JSON.stringify(value);
}
export type BookExportPlan =
  | { kind: 'write'; path: string; content: string; cover?: { from: string; to: string } }
  | { kind: 'delete'; path: string }
  | { kind: 'noop'; path: string };
export function planBookExport(input: {
  /** 작업 공간의 파일 이름(NOR-212). 없으면 문서 내용으로 계산한다(등록 시점의 규칙). */
  id?: string;
  record: BookDocument;
  current: string | null;
  cover?: { workspacePath: string; info: PublicCover };
}): BookExportPlan {
  const id = input.id ?? bookIdOf(input.record);
  if (!isBookId(id)) throw new Error('invalid book id');
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

/** `public: true` 이고 id 가 있는 구절만. 메모는 나가지 않는다(NOR-215). */
function publicQuotes(
  record: BookDocument,
): { id: string; text: string; page?: number }[] | undefined {
  const quotes = (record.excerpts ?? [])
    .filter((excerpt) => excerpt.public === true && excerpt.id !== undefined)
    .map((excerpt) => ({
      id: excerpt.id as string,
      text: excerpt.text,
      ...(excerpt.page === undefined ? {} : { page: excerpt.page }),
    }));
  return quotes.length === 0 ? undefined : quotes;
}
