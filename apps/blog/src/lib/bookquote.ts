import type { BookquoteSource } from '@gze1206/content-contract';
import { booksPath } from './routes';

export interface BookquoteCaption {
  authors: string;
  title: string;
  translators?: string;
  publisher?: string;
  year?: string;
  page?: string;
  href?: string;
}
export function formatBookquoteCaption(
  source: BookquoteSource,
  shelfIds: ReadonlySet<string>,
): BookquoteCaption {
  return {
    authors: source.authors.join(', '),
    title: `『${source.title}』`,
    ...(source.translators.length ? { translators: `${source.translators.join(', ')} 옮김` } : {}),
    ...(source.publisher !== undefined ? { publisher: source.publisher } : {}),
    ...(source.year !== undefined ? { year: String(source.year) } : {}),
    ...(source.page !== undefined ? { page: `p. ${source.page}` } : {}),
    ...(shelfIds.has(source.book) ? { href: booksPath(source.book) } : {}),
  };
}

/** figcaption 에 쓰는 순서: 저자, 『제목』, 역자, 출판사, 연도, 쪽수. 빈 항목은 뺀다. */
export function captionSegments(caption: BookquoteCaption): string[] {
  return [
    caption.authors,
    caption.title,
    caption.translators,
    caption.publisher,
    caption.year,
    caption.page,
  ].filter((part): part is string => Boolean(part));
}
