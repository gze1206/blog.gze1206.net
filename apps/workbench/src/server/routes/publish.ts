import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { isBookId } from '@gze1206/content-contract';

import type { FileStore } from '../../core/ports.js';
import { SiteReviewError, type PublicBlogPublisher } from '../adapters/publicBlog.js';
import { encodeDocumentId, isDocumentId } from '../documentIds.js';

const opaqueIdSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
const reviewSchema = z
  .object({
    id: z.string().refine(isDocumentId, 'Invalid document id'),
    assetIds: z.array(opaqueIdSchema).max(100).default([]),
  })
  .strict();
const confirmSchema = reviewSchema.extend({
  confirmPublish: z.literal(true),
  reviewId: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
});

export function createPublishRoutes(store: FileStore, publisher: PublicBlogPublisher): Hono {
  const routes = new Hono();

  // 공개 초안의 발행 상태와 블로그에만 있는 글 (NOR-209 AC-3).
  routes.get('/api/publish/status', async (context) => {
    if (!publisher.publishStatus) throw new Error('publish status is unavailable');
    const drafts: { documentId: string; source: string }[] = [];
    for (const summary of (await store.listDocuments()).documents) {
      if (summary.kind !== 'public-draft') continue;
      const entry = await store.readDocument(summary.relativePath);
      if (entry.document.kind !== 'public-draft' || entry.document.publicEligible !== true)
        continue;
      drafts.push({ documentId: encodeDocumentId(summary.relativePath), source: entry.source });
    }
    return context.json(await publisher.publishStatus(drafts));
  });

  // 공개 초안 본문 이미지 올리기 (NOR-219 AC-6). 5MB 를 넘는 본문은 읽기 전에 막는다.
  routes.post(
    '/api/publish/assets/:id',
    bodyLimit({
      maxSize: 5 * 1024 * 1024,
      onError: (context) => context.json(errorBody('too_large', 'Image is too large'), 413),
    }),
    async (context) => {
      const id = context.req.param('id');
      if (!isDocumentId(id))
        return context.json(errorBody('invalid_id', 'Invalid document id'), 400);
      if (!publisher.savePublicAsset) return context.json(errorBody('not_found', 'Not found'), 404);
      const entry = await readPublicDraft(store, id);
      if (!entry) return context.json(errorBody('not_found', 'Document not found'), 404);
      const bytes = new Uint8Array(await context.req.arrayBuffer());
      const name = (context.req.query('name') ?? 'image').slice(0, 200);
      try {
        return context.json(await publisher.savePublicAsset(id, bytes, name), 201);
      } catch (error) {
        if (error instanceof SiteReviewError)
          return context.json(errorBody('invalid_image', error.message), 400);
        throw error;
      }
    },
  );

  routes.get('/api/publish/assets/:id', async (context) => {
    const id = context.req.param('id');
    if (!isDocumentId(id)) return context.json(errorBody('invalid_id', 'Invalid document id'), 400);
    const entry = await readPublicDraft(store, id);
    if (!entry) return context.json(errorBody('not_found', 'Document not found'), 404);
    return context.json(await publisher.listAssets(id));
  });

  routes.post('/api/publish/review', async (context) => {
    const input = reviewSchema.safeParse(await readJson(context.req.raw));
    if (!input.success) {
      return context.json(errorBody('invalid_request', 'Invalid publish review input'), 400);
    }
    const entry = await readPublicDraft(store, input.data.id);
    if (!entry) return context.json(errorBody('not_found', 'Document not found'), 404);
    return context.json(
      await publisher.review({
        documentId: input.data.id,
        source: entry.source,
        assetIds: input.data.assetIds,
      }),
    );
  });

  routes.post('/api/publish/confirm', async (context) => {
    const input = confirmSchema.safeParse(await readJson(context.req.raw));
    if (!input.success) {
      return context.json(
        errorBody('invalid_request', 'Publishing requires confirmPublish: true'),
        400,
      );
    }
    const entry = await readPublicDraft(store, input.data.id);
    if (!entry) return context.json(errorBody('not_found', 'Document not found'), 404);
    const result = await publisher.publish({
      source: entry.source,
      documentId: input.data.id,
      assetIds: input.data.assetIds,
      confirmPublish: true,
      reviewId: input.data.reviewId,
    });
    return context.json(result, 201);
  });

  routes.post('/api/publish/books/:id/review', async (context) => {
    const id = context.req.param('id');
    if (!isBookId(id)) return context.json(errorBody('invalid_id', 'Invalid book id'), 400);
    if (!publisher.reviewBook) throw new Error('book publishing is unavailable');
    return context.json(await publisher.reviewBook(id));
  });

  routes.post('/api/publish/books/:id/confirm', async (context) => {
    const id = context.req.param('id');
    if (!isBookId(id)) return context.json(errorBody('invalid_id', 'Invalid book id'), 400);
    const input = z
      .object({ confirmPublish: z.literal(true), reviewId: opaqueIdSchema })
      .strict()
      .safeParse(await readJson(context.req.raw));
    if (!input.success)
      return context.json(
        errorBody('invalid_request', 'Publishing requires confirmPublish: true'),
        400,
      );
    if (!publisher.publishBook) throw new Error('book publishing is unavailable');
    return context.json(await publisher.publishBook(id, input.data), 201);
  });

  return routes;
}

async function readPublicDraft(store: FileStore, id: string) {
  const summary = (await store.listDocuments()).documents.find(
    ({ relativePath }) => encodeDocumentId(relativePath) === id,
  );
  if (!summary) return null;
  const entry = await store.readDocument(summary.relativePath);
  if (entry.document.kind !== 'public-draft' || entry.document.publicEligible !== true) {
    throw new Error('only publicEligible public-draft documents can be published');
  }
  return entry;
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
