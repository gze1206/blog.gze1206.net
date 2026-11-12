import { isBookId, renderBookquote } from '@gze1206/content-contract';
import type { BookDocument } from '../document/document.js';
import { PublicDraftValidationError } from './validate.js';

export type BookLookup = (bookId: string) => BookDocument | undefined;
export interface ExpandedQuote {
  book: string;
  excerpt: string;
  length: number;
  bookPublicTotal: number;
}
export const QUOTE_LIMITS = { single: 500, bookTotal: 2000 } as const;
export function expandBookquotes(
  body: string,
  lookup: BookLookup,
): { body: string; quotes: ExpandedQuote[] } {
  // 태그 이름 앞뒤의 공백·서식 문자(\p{Cf})와 대소문자를 지운 이름이 bookquote 계열이면 인용 후보다.
  // 원본 형식(`{% bookquote …`)이 아니면 모두 거부한다(fail-closed).
  for (const match of body.matchAll(/\{%([\s\p{Cf}]*)([^\s%}]+)/gu)) {
    const prefix = match[1] ?? '';
    const name = match[2] ?? '';
    const normalized = name.replace(/\p{Cf}/gu, '').toLowerCase();
    if (!/^\/?bookquote(?![a-z0-9_-])/u.test(normalized)) continue;
    if (name !== 'bookquote' || /\p{Cf}/u.test(prefix))
      throw new PublicDraftValidationError('invalid bookquote source');
  }
  const quotes: ExpandedQuote[] = [];
  const expanded = body.replace(/\{%\s*bookquote\b[\s\S]*?%\}/gu, (tag) => {
    const match = /^\{%\s*bookquote\s+book="([^"\r\n]+)"\s+excerpt="([^"\r\n]+)"\s*\/%\}$/u.exec(
      tag,
    );
    if (!match || !match[1] || !match[2] || !isBookId(match[1]))
      throw new PublicDraftValidationError('invalid bookquote source');
    const book = lookup(match[1]);
    const excerpt = book?.excerpts?.find((item) => item.id === match[2]);
    if (
      !book ||
      book.kind !== 'book' ||
      !book.title.trim() ||
      !book.authors?.length ||
      book.authors.some((author) => !author.trim()) ||
      !excerpt ||
      excerpt.public !== true
    )
      throw new PublicDraftValidationError('unavailable public bookquote');
    quotes.push({
      book: match[1],
      excerpt: excerpt.text,
      length: [...excerpt.text].length,
      bookPublicTotal: (book.excerpts ?? [])
        .filter((item) => item.public === true)
        .reduce((sum, item) => sum + [...item.text].length, 0),
    });
    return renderBookquote(
      {
        book: match[1],
        title: book.title,
        authors: book.authors,
        translators: book.translators ?? [],
        ...(book.publisher === undefined ? {} : { publisher: book.publisher }),
        ...(book.publishedYear === undefined ? {} : { year: book.publishedYear }),
        ...(excerpt.page === undefined ? {} : { page: excerpt.page }),
      },
      excerpt.text,
    );
  });
  if (/\{%\s*\/?bookquote\b/u.test(body.replace(/\{%\s*bookquote\b[\s\S]*?%\}/gu, '')))
    throw new PublicDraftValidationError('invalid bookquote source');
  return { body: expanded, quotes };
}
export function quoteWarnings(quotes: readonly ExpandedQuote[]): string[] {
  const warnings: string[] = [];
  const warned = new Set<string>();
  for (const quote of quotes) {
    if (quote.length > QUOTE_LIMITS.single)
      warnings.push(
        `${quote.book}: 구절이 ${QUOTE_LIMITS.single}자를 초과합니다 (${quote.length}자).`,
      );
    if (quote.bookPublicTotal > QUOTE_LIMITS.bookTotal && !warned.has(quote.book)) {
      warnings.push(
        `${quote.book}: 공개 구절 합계가 ${QUOTE_LIMITS.bookTotal}자를 초과합니다 (${quote.bookPublicTotal}자).`,
      );
      warned.add(quote.book);
    }
  }
  return warnings;
}
