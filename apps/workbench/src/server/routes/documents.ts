import { randomUUID } from 'node:crypto';

import { Hono } from 'hono';
import { z } from 'zod';

import type { WorkbenchDocument } from '../../core/document/document.js';
import type { DocumentEntry, DocumentSummary, FileStore } from '../../core/ports.js';
import { encodeDocumentId, isDocumentId } from '../documentIds.js';

const createSchema = z.object({
  templateId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  title: z.string().trim().min(1).max(200),
  period: z.string().trim().min(1).max(20).optional(),
});
const updateSchema = z.object({ source: z.string().min(1).max(5_000_000) });

export function createDocumentRoutes(
  store: FileStore,
  clock: () => Date = () => new Date(),
  createId: () => string = randomUUID,
): Hono {
  const routes = new Hono();

  routes.get('/api/documents/templates', async (context) =>
    context.json(await store.listTemplates()),
  );

  routes.get('/api/documents', async (context) => {
    // 읽지 못한 파일도 함께 알린다. 목록에서 빠진 이유를 화면이 말할 수 있어야 한다(NOR-190).
    const { documents, problems } = await store.listDocuments();
    return context.json({ documents: documents.map(toHttpSummary), problems });
  });

  routes.post('/api/documents', async (context) => {
    const input = createSchema.safeParse(await readJson(context.req.raw));
    if (!input.success)
      return context.json(errorBody('invalid_request', 'Invalid document input'), 400);

    const template = (await store.listTemplates()).find(({ id }) => id === input.data.templateId);
    if (!template)
      return context.json(errorBody('invalid_request', 'Unknown document template'), 400);
    const periodError = validateReviewPeriod(template.kind, input.data.period);
    if (periodError) return context.json(errorBody('invalid_request', periodError), 400);

    const now = clock();
    const date = now.toISOString().slice(0, 10);
    const entry = await store.createFromTemplate({
      templateId: input.data.templateId,
      title: input.data.title,
      tokens: {
        date,
        isoDate: now.toISOString(),
        period: input.data.period ?? date,
        id: createId(),
      },
    });
    return context.json(toHttpEntry(entry), 201);
  });

  routes.get('/api/documents/:id', async (context) => {
    const id = context.req.param('id');
    if (!isDocumentId(id)) return context.json(errorBody('invalid_id', 'Invalid document id'), 400);
    const relativePath = await resolveDocumentPath(store, id);
    if (!relativePath) return context.json(errorBody('not_found', 'Document not found'), 404);
    return context.json(toHttpEntry(await store.readDocument(relativePath)));
  });

  routes.put('/api/documents/:id', async (context) => {
    const id = context.req.param('id');
    if (!isDocumentId(id)) return context.json(errorBody('invalid_id', 'Invalid document id'), 400);
    const input = updateSchema.safeParse(await readJson(context.req.raw));
    if (!input.success)
      return context.json(errorBody('invalid_request', 'Invalid document source'), 400);
    const relativePath = await resolveDocumentPath(store, id);
    if (!relativePath) return context.json(errorBody('not_found', 'Document not found'), 404);
    return context.json(toHttpEntry(await store.writeDocument(relativePath, input.data.source)));
  });

  return routes;
}

function validateReviewPeriod(kind: string, period: string | undefined): string | null {
  if (kind === 'weekly-review' && !/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/u.test(period ?? '')) {
    return 'Weekly review period must use YYYY-Www (W01-W53)';
  }
  if (kind === 'monthly-review' && !/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(period ?? '')) {
    return 'Monthly review period must use YYYY-MM (01-12)';
  }
  return null;
}

function toHttpSummary(document: DocumentSummary) {
  return {
    id: encodeDocumentId(document.relativePath),
    label: document.label,
    title: document.title,
    kind: document.kind,
    updatedAt: document.updatedAt,
    ...(document.cover === undefined ? {} : { cover: document.cover }),
  };
}

function toHttpEntry(entry: DocumentEntry) {
  return {
    ...toHttpSummary({
      relativePath: entry.relativePath,
      label: entry.relativePath.split('/').at(-1)?.replace(/\.md$/u, '') ?? entry.document.title,
      title: entry.document.title,
      kind: entry.document.kind,
      updatedAt: entry.document.updatedAt,
      ...(entry.document.cover === undefined ? {} : { cover: entry.document.cover }),
    }),
    source: entry.source,
    /*
      구절과 책 정보는 화면에서 폼으로 다루므로 풀어서 함께 보낸다. 브라우저에서 frontmatter 를
      다시 파싱하지 않는다 — 파일의 뜻을 정하는 곳은 서버 하나여야 한다.
    */
    ...(entry.document.excerpts === undefined ? {} : { excerpts: entry.document.excerpts }),
    ...(entry.document.memos === undefined ? {} : { memos: entry.document.memos }),
    ...(entry.document.kind === 'book' ? { book: toBookFields(entry.document) } : {}),
  };
}

/** 폼이 다루는 책 필드. 여기 없는 것(표지·구절·모르는 필드)은 폼이 건드리지 않는다. */
function toBookFields(document: WorkbenchDocument) {
  const {
    title,
    authors,
    status,
    format,
    source,
    visible,
    translators,
    publisher,
    publishedYear,
    isbn13,
    coverSource,
    startedAt,
    finishedAt,
    rating,
    tags,
    oneLiner,
    relatedPost,
    content,
  } = document;
  return {
    title,
    authors,
    status,
    format,
    source,
    visible,
    translators,
    publisher,
    publishedYear,
    isbn13,
    coverSource,
    startedAt,
    finishedAt,
    rating,
    tags,
    oneLiner,
    relatedPost,
    content,
  };
}

async function resolveDocumentPath(store: FileStore, id: string): Promise<string | null> {
  const { documents } = await store.listDocuments();
  const document = documents.find(({ relativePath }) => encodeDocumentId(relativePath) === id);
  return document?.relativePath ?? null;
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
