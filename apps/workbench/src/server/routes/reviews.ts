import { randomUUID } from 'node:crypto';

import { Hono } from 'hono';
import { z } from 'zod';

import { isCalendarDate } from '../../core/bullets/date.js';
import { parseBullets } from '../../core/bullets/parse.js';
import { parseDocument, serializeDocument } from '../../core/document/document.js';
import type { FileStore } from '../../core/ports.js';
import { calendarDateInTimeZone } from '../../core/reviews/calendar.js';
import { isCurrentOrPastReviewPeriod, type ReviewKind } from '../../core/reviews/period.js';
import { getReviewSuggestion } from '../../core/reviews/suggestion.js';
import type { JournalStore } from '../adapters/journalStore.js';
import { encodeDocumentId } from '../documentIds.js';

const reviewKind = z.enum(['weekly-review', 'monthly-review']);
const periodKey = z.string().regex(/^(?:weekly-review:\d{4}-W\d{2}|monthly-review:\d{4}-\d{2})$/u);
const bulletReference = z.object({
  date: z.string().refine(isCalendarDate, 'reference date must be a real Gregorian date'),
  id: z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u),
});
const createSchema = z
  .object({
    kind: reviewKind,
    period: z.string().trim().min(1).max(8),
    title: z.string().trim().min(1).max(200).optional(),
    bulletReferences: z.array(bulletReference).max(50).optional(),
  })
  .strict();

export interface ReviewRouteOptions {
  readonly clock: () => Date;
  readonly createId: () => string;
  readonly timeZone: string;
}

const defaultOptions: ReviewRouteOptions = {
  clock: () => new Date(),
  createId: randomUUID,
  timeZone: 'UTC',
};

export function createReviewRoutes(
  store: FileStore,
  journalStore?: JournalStore,
  options: ReviewRouteOptions = defaultOptions,
): Hono {
  const routes = new Hono();

  routes.get('/api/reviews/suggestion', async (context) => {
    const searchParams = new URL(context.req.url).searchParams;
    if ([...searchParams.keys()].some((key) => key !== 'skipped')) {
      return context.json(errorBody('invalid_request', 'Invalid review suggestion input'), 400);
    }
    const skippedInput = searchParams.getAll('skipped');
    const skipped = z.array(periodKey).max(100).safeParse(skippedInput);
    if (!skipped.success)
      return context.json(errorBody('invalid_request', 'Invalid skipped review period'), 400);

    const { documents: summaries } = await store.listDocuments();
    const reviewEntries = await Promise.all(
      summaries.filter(isReviewSummary).map(({ relativePath }) => store.readDocument(relativePath)),
    );
    const documents = reviewEntries.flatMap(({ document }) =>
      isReviewDocument(document) ? [{ kind: document.kind, period: document.period }] : [],
    );
    const now = options.clock();
    return context.json({
      today: calendarDateInTimeZone(now, options.timeZone),
      suggestion: getReviewSuggestion(now, options.timeZone, documents, skipped.data),
    });
  });

  routes.post('/api/reviews', async (context) => {
    const input = createSchema.safeParse(await readJson(context.req.raw));
    if (!input.success)
      return context.json(errorBody('invalid_request', 'Invalid review input'), 400);
    if (
      !isCurrentOrPastReviewPeriod(
        options.clock(),
        options.timeZone,
        input.data.kind,
        input.data.period,
      )
    ) {
      return context.json(
        errorBody('invalid_request', 'Review period must be a real current or past period'),
        400,
      );
    }

    const references = await resolveBulletReferences(
      journalStore,
      input.data.bulletReferences ?? [],
    );
    if (references === null) {
      return context.json(errorBody('invalid_request', 'Unknown bullet reference'), 400);
    }
    const template = (await store.listTemplates()).find(({ kind }) => kind === input.data.kind);
    if (!template)
      return context.json(errorBody('invalid_request', 'Unknown review template'), 400);

    const now = options.clock();
    const date = calendarDateInTimeZone(now, options.timeZone);
    let entry = await store.createFromTemplate({
      templateId: template.id,
      title:
        input.data.title ??
        `${input.data.period} ${input.data.kind === 'weekly-review' ? '주간 회고' : '월간 회고'}`,
      tokens: {
        date,
        isoDate: now.toISOString(),
        period: input.data.period,
        id: options.createId(),
      },
    });
    if (references.length > 0) {
      const document = parseDocument(entry.source);
      const prefix = document.content.endsWith('\n') ? document.content : `${document.content}\n`;
      const content = `${prefix}\n## 연결된 불렛\n\n${references
        .map(
          ({ date: sourceDate, id, text }) =>
            `- [${escapeMarkdownLabel(text)}](/day/${sourceDate}#bullet-${id})`,
        )
        .join('\n')}\n`;
      entry = await store.writeDocument(
        entry.relativePath,
        serializeDocument({ ...document, updatedAt: date, content }),
      );
    }
    return context.json(toHttpEntry(entry), 201);
  });

  return routes;
}

async function resolveBulletReferences(
  journalStore: JournalStore | undefined,
  references: readonly z.infer<typeof bulletReference>[],
): Promise<
  readonly { readonly date: string; readonly id: string; readonly text: string }[] | null
> {
  if (references.length === 0) return [];
  if (!journalStore) return null;
  const resolved = [];
  const seen = new Set<string>();
  for (const reference of references) {
    const key = `${reference.date}:${reference.id}`;
    if (seen.has(key)) continue;
    const source = await journalStore.read(reference.date);
    const bullet = source
      ? parseBullets(parseDocument(source).content).find(({ id }) => id === reference.id)
      : undefined;
    if (!bullet) return null;
    seen.add(key);
    resolved.push({ ...reference, text: bullet.text });
  }
  return resolved;
}

function isReviewSummary(summary: { readonly kind: string }): boolean {
  return summary.kind === 'weekly-review' || summary.kind === 'monthly-review';
}

function isReviewDocument(document: {
  readonly kind: string;
  readonly period?: string | undefined;
}): document is { readonly kind: ReviewKind; readonly period: string } {
  return (
    (document.kind === 'weekly-review' || document.kind === 'monthly-review') &&
    typeof document.period === 'string'
  );
}

function escapeMarkdownLabel(value: string): string {
  return value.replace(/[\\[\]]/gu, '\\$&');
}

function toHttpEntry(entry: Awaited<ReturnType<FileStore['createFromTemplate']>>) {
  return {
    id: encodeDocumentId(entry.relativePath),
    label: entry.relativePath.split('/').at(-1)?.replace(/\.md$/u, '') ?? entry.document.title,
    title: entry.document.title,
    kind: entry.document.kind,
    updatedAt: entry.document.updatedAt,
    source: entry.source,
  };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}
