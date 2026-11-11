import { z } from 'zod';

import {
  orderedFields,
  parseFrontmatter,
  serializeFrontmatter,
  splitKnownFields,
} from './frontmatter.js';

export const documentKinds = [
  'capture',
  'journal',
  'note',
  'private-post',
  'public-draft',
  'weekly-review',
  'monthly-review',
  // 읽은 책 한 권 (NOR-189). 본문은 그 책에 대한 비공개 메모다.
  'book',
] as const;

export type DocumentKind = (typeof documentKinds)[number];

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const publishDateInputSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'expected a date or ISO timestamp',
  });
/**
 * 책에서 옮겨 적은 구절 하나 (NOR-189).
 *
 * `text` 는 **저자의 말을 그대로** 옮긴 것이고 `memo` 는 그 구절에 붙인 내 생각이다. 둘을 한
 * 덩어리에 담되 필드를 나눠 두는 이유는, 누구의 말인지 나중에도 구분할 수 있어야 하기
 * 때문이다 — 인용은 출처를 밝혀야 하고 내 글은 그럴 필요가 없다.
 */
const excerptSchema = z
  .object({
    /** 몇 쪽에서 옮겼나. 페이지를 안 알려 주는 앱도 있어 없을 수 있다. */
    page: z.number().int().positive().optional(),
    text: z.string().min(1),
    /** 이 구절에 대한 메모. 책 전체를 향한 메모는 `memos` 로 간다. */
    memo: z.string().min(1).optional(),
    /** 옮겨 적은 날. 무엇을 언제 읽었는지 되짚을 때 쓴다. */
    addedAt: dateSchema.optional(),
  })
  .strict();

/**
 * 읽으면서 남긴 메모 하나 (NOR-189).
 *
 * 구절에 딸린 메모와 다르다 — 옮겨 적을 문장이 없어도 떠오르는 생각이 있다. 다 읽고 쓰는
 * 독서 노트(문서 본문)와도 다르다. 이쪽은 읽는 **도중에** 던져 두는 짧은 것이다.
 */
const readingMemoSchema = z
  .object({
    page: z.number().int().positive().optional(),
    text: z.string().min(1),
    addedAt: dateSchema.optional(),
  })
  .strict();

export type BookExcerpt = z.infer<typeof excerptSchema>;
export type ReadingMemo = z.infer<typeof readingMemoSchema>;

const commonSchema = z.object({
  title: z.string().min(1),
  kind: z.enum(documentKinds),
  createdAt: dateSchema,
  updatedAt: publishDateInputSchema,
  date: dateSchema.optional(),
  tags: z.array(z.string()).optional(),
  publicEligible: z.boolean().optional(),
  period: z.string().optional(),
  description: z.string().optional(),
  slug: z.string().optional(),
  category: z.string().optional(),
  series: z.string().optional(),
  seriesOrder: z.number().int().positive().optional(),
  publishedAt: publishDateInputSchema.optional(),
  draft: z.boolean().optional(),
  // --- 책 (NOR-189) ---
  authors: z.array(z.string().min(1)).optional(),
  translators: z.array(z.string().min(1)).optional(),
  publisher: z.string().min(1).optional(),
  publishedYear: z.number().int().optional(),
  isbn13: z
    .string()
    .regex(/^\d{13}$/u, 'isbn13 must be 13 digits')
    .optional(),
  /** 작업 공간 안에 저장한 표지 경로. 남의 서버 주소를 그대로 걸지 않는다. */
  cover: z.string().min(1).optional(),
  /** 표지·서지정보의 출처. 어디서 받은 것인지 남긴다. */
  coverSource: z.string().min(1).optional(),
  status: z.enum(['reading', 'finished', 'abandoned', 'want']).optional(),
  startedAt: dateSchema.optional(),
  finishedAt: dateSchema.optional(),
  format: z.enum(['ebook', 'paper', 'audio']).optional(),
  /** 어떻게 읽었나. 도서관 전자책 대출이 가장 흔하다. */
  source: z.enum(['library', 'purchase', 'subscription', 'borrowed']).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  /** 공개하는 한 줄 감상. 본문(비공개 메모)과 구분한다. */
  oneLiner: z.string().min(1).optional(),
  /**
   * 옮겨 적은 구절. 남의 저작물이므로 공개 경로로 나가지 않는다.
   *
   * 독서 기록은 네 가지가 서로 다른 것이다:
   * - **구절**(`excerpts[].text`) — 저자의 말을 그대로. 한 지점에 매인다.
   * - **구절 메모**(`excerpts[].memo`) — 그 구절에 대한 내 생각. 그 구절에 매인다.
   * - **독서 메모**(`memos`) — 읽으면서 떠오른 내 생각. 옮길 문장이 없어도 남긴다.
   * - **독서 노트**(문서 본문) — 다 읽고 쓰는 라이트한 독후감. 책 전체를 향한 글이다.
   *
   * 블로그에 실리는 감상은 `oneLiner` 한 줄뿐이고, 그 한 줄은 내가 쓴 말이다.
   */
  excerpts: z.array(excerptSchema).optional(),
  /** 읽는 도중에 남긴 메모. 구절에 매이지 않는다. */
  memos: z.array(readingMemoSchema).optional(),
  relatedPost: z.string().min(1).optional(),
  /** 읽은 목록은 공개가 기본이다. 감추는 것이 예외다. */
  visible: z.boolean().optional(),
});

const knownKeys = [
  'title',
  'kind',
  'createdAt',
  'updatedAt',
  'date',
  'tags',
  'publicEligible',
  'period',
  'description',
  'slug',
  'category',
  'series',
  'seriesOrder',
  'publishedAt',
  'draft',
  'authors',
  'translators',
  'publisher',
  'publishedYear',
  'isbn13',
  'cover',
  'coverSource',
  'status',
  'startedAt',
  'finishedAt',
  'format',
  'source',
  'rating',
  'oneLiner',
  'excerpts',
  'memos',
  'relatedPost',
  'visible',
] as const;

const commonKeys = ['title', 'kind', 'createdAt', 'updatedAt'] as const;
const kindKeys: Record<DocumentKind, readonly (typeof knownKeys)[number][]> = {
  capture: [],
  journal: ['date'],
  note: ['tags'],
  'private-post': ['tags'],
  'public-draft': [
    'publicEligible',
    'description',
    'slug',
    'category',
    'tags',
    'series',
    'seriesOrder',
    'publishedAt',
    'draft',
  ],
  'weekly-review': ['period'],
  'monthly-review': ['period'],
  book: [
    'authors',
    'translators',
    'publisher',
    'publishedYear',
    'isbn13',
    'cover',
    'coverSource',
    'status',
    'startedAt',
    'finishedAt',
    'format',
    'source',
    'rating',
    'tags',
    'oneLiner',
    'excerpts',
    'memos',
    'relatedPost',
    'visible',
  ],
};

export interface WorkbenchDocument extends z.infer<typeof commonSchema> {
  readonly content: string;
  readonly extra: Record<string, unknown>;
}

export class DocumentValidationError extends Error {
  public override readonly name = 'DocumentValidationError';
}

export function parseDocument(source: string): WorkbenchDocument {
  try {
    const { data, content } = parseFrontmatter(source);
    assertSupportedKind(data.kind, documentKinds, 'document');
    const recognizedKeys = [...commonKeys, ...kindKeys[data.kind]];
    const recognizedInput = Object.fromEntries(
      recognizedKeys.filter((key) => key in data).map((key) => [key, data[key]]),
    );
    const recognized = commonSchema.parse(recognizedInput);
    validateKindFields(recognized);
    return { ...recognized, content, extra: splitKnownFields(data, recognizedKeys) };
  } catch (error) {
    if (error instanceof DocumentValidationError) throw error;
    throw new DocumentValidationError(
      error instanceof Error ? error.message : 'invalid document source',
      { cause: error },
    );
  }
}

export function serializeDocument(document: WorkbenchDocument): string {
  const value = document as unknown as Record<string, unknown>;
  return serializeFrontmatter(orderedFields(value, knownKeys, document.extra), document.content);
}

export function assertSupportedKind(
  value: unknown,
  supported: readonly string[],
  subject: 'document' | 'template',
): asserts value is DocumentKind {
  if (typeof value !== 'string' || !supported.includes(value)) {
    throw new Error(`unsupported ${subject} kind: ${String(value)}`);
  }
}

function validateKindFields(document: z.infer<typeof commonSchema>): void {
  if (document.kind === 'book') {
    // 저자 없는 책은 나중에 찾을 수 없다. 서지정보 조회가 실패해도 이 둘은 사람이 적는다.
    if ((document.authors ?? []).length === 0) {
      throw new DocumentValidationError('book document requires authors');
    }
    if (document.status === undefined) {
      throw new DocumentValidationError('book document requires status');
    }
  }
  if (document.kind === 'journal' && !document.date) {
    throw new Error('journal document requires date');
  }
  if (document.kind === 'public-draft' && document.publicEligible !== true) {
    throw new Error('public-draft document requires publicEligible: true');
  }
  if (
    document.kind === 'weekly-review' &&
    !/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(document.period ?? '')
  ) {
    throw new DocumentValidationError('weekly-review document requires period YYYY-Www');
  }
  if (
    document.kind === 'monthly-review' &&
    !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(document.period ?? '')
  ) {
    throw new DocumentValidationError('monthly-review document requires period YYYY-MM');
  }
}
