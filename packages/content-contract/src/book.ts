import { z } from 'zod';
export const BOOK_STATUSES = ['reading', 'finished', 'abandoned', 'want'] as const;
export const BOOK_FORMATS = ['ebook', 'paper', 'audio'] as const;
export const BOOK_SOURCES = ['library', 'purchase', 'subscription', 'borrowed'] as const;
export const bookCoverSchema = z.object({
  src: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  source: z.string().min(1).optional(),
});
/** 같은 책의 공개 구절 누적 상한(글자). 맥락 없이 많은 분량을 옮기지 않는다(NOR-196, NOR-215). */
export const BOOK_QUOTE_TOTAL_LIMIT = 2000;

/** 공개 구절 하나. 워크벤치 구절 중 `public: true` 인 것만 이 모양으로 나간다(NOR-215). */
export const bookQuoteSchema = z
  .object({
    id: z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u),
    text: z.string().min(1),
    page: z.number().int().positive().optional(),
    /** 그 구절에 남긴 내 메모(NOR-230). 내가 쓴 말이라 구절 누적 상한에 넣지 않는다. */
    memo: z.string().min(1).max(1000).optional(),
  })
  .strict();

export const bookObject = z.object({
  title: z.string().min(1),
  authors: z.array(z.string().min(1)).min(1),
  translators: z.array(z.string().min(1)).default([]),
  publisher: z.string().min(1).optional(),
  publishedYear: z.number().int().optional(),
  isbn13: z
    .string()
    .regex(/^\d{13}$/, 'ISBN13 은 숫자 13자리다')
    .optional(),
  cover: bookCoverSchema.optional(),
  status: z.enum(BOOK_STATUSES),
  startedAt: z.coerce.date().optional(),
  finishedAt: z.coerce.date().optional(),
  format: z.enum(BOOK_FORMATS),
  /** 어떻게 읽었나. 도서관 전자책 대출이 가장 흔하다. */
  source: z.enum(BOOK_SOURCES),
  rating: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string().min(1)).default([]),
  /** 공개하는 한 줄 감상. 없으면 목록에 제목·저자만 남는다. */
  oneLiner: z.string().min(1).optional(),
  /** 감상을 글로 썼다면 그 글의 slug. */
  relatedPost: z.string().min(1).optional(),
  /** 공개 구절. 블로그 /books 에 보이고, 글의 bookquote 인용과 같은 원본이다. */
  quotes: z
    .array(bookQuoteSchema)
    .default([])
    .refine(
      (quotes) =>
        quotes.reduce((total, quote) => total + quote.text.length, 0) <= BOOK_QUOTE_TOTAL_LIMIT,
      { message: `공개 구절은 책마다 ${BOOK_QUOTE_TOTAL_LIMIT}자까지다` },
    ),
});

export const bookSchema = bookObject;
export const strictBookSchema = bookObject.strict();
export const PUBLIC_BOOK_FIELDS: readonly (keyof typeof bookObject.shape)[] = Object.keys(
  bookObject.shape,
) as (keyof typeof bookObject.shape)[];
export const BOOK_ID_PATTERN = /^[^\s\p{Cc}\p{Cf}/\\?%*:|"<>.]{1,60}$/u;
export function isBookId(id: string): boolean {
  return BOOK_ID_PATTERN.test(id);
}
export type PublicBook = z.infer<typeof bookSchema>;
