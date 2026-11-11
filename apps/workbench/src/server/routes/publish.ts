import { Hono } from 'hono';
import { z } from 'zod';

import type { FileStore } from '../../core/ports.js';
import type { PublicBlogPublisher } from '../adapters/publicBlog.js';
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
