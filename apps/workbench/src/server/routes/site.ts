import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

import { SiteReviewError, type PublicBlogPublisher } from '../adapters/publicBlog.js';
import {
  SITE_COLLECTION_NAMES,
  validateSiteChange,
  type SiteChange,
} from '../../core/site/siteContent.js';

type SitePublisher = Required<Pick<PublicBlogPublisher, 'listSite' | 'reviewSite' | 'publishSite'>>;

const collectionSchema = z.enum(SITE_COLLECTION_NAMES as [string, ...string[]]);
const idSchema = z.string().min(1).max(80);
const baseHashSchema = z.union([z.string().regex(/^[0-9a-f]{64}$/u), z.null()]).optional();
const changeSchema = z.union([
  z
    .object({
      collection: collectionSchema,
      id: idSchema,
      data: z.record(z.string(), z.unknown()),
      baseHash: baseHashSchema,
    })
    .strict(),
  z
    .object({
      collection: collectionSchema,
      id: idSchema,
      delete: z.literal(true),
      baseHash: baseHashSchema,
    })
    .strict(),
]);
/** 사이트 콘텐츠 JSON 은 작다. 큰 본문은 읽기 전에 막는다(NOR-208 AC-9). */
const MAX_BODY = 256 * 1024;
const opaqueIdSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);

/** 사이트 콘텐츠 편집·발행 (NOR-208). 원본은 공개 저장소의 JSON 이다. */
export function createSiteRoutes(publisher: SitePublisher): Hono {
  const routes = new Hono();

  routes.use(
    '/api/site/*',
    bodyLimit({
      maxSize: MAX_BODY,
      onError: (context) => context.json(errorBody('too_large', 'Request body is too large'), 413),
    }),
  );
  routes.onError((error, context) => {
    if (error instanceof SiteReviewError)
      return context.json(
        {
          error: {
            code: error.status === 409 ? 'conflict' : 'invalid_content',
            message: error.message,
            issues: error.issues,
          },
        },
        error.status,
      );
    throw error;
  });

  routes.get('/api/site', async (context) => context.json(await publisher.listSite()));

  routes.post('/api/site/review', async (context) => {
    const parsed = parseChange(await readJson(context.req.raw));
    if ('error' in parsed) return context.json(parsed.error, 400);
    return context.json(await publisher.reviewSite(parsed.change));
  });

  routes.post('/api/site/confirm', async (context) => {
    const body = await readJson(context.req.raw);
    const confirm = z
      .object({ confirmPublish: z.literal(true), reviewId: opaqueIdSchema })
      .safeParse(body);
    if (!confirm.success)
      return context.json(
        errorBody('invalid_request', 'Publishing requires confirmPublish: true'),
        400,
      );
    const {
      confirmPublish: _confirm,
      reviewId: _review,
      ...rest
    } = body as Record<string, unknown>;
    const parsed = parseChange(rest);
    if ('error' in parsed) return context.json(parsed.error, 400);
    return context.json(await publisher.publishSite(parsed.change, confirm.data), 201);
  });

  return routes;
}

function parseChange(body: unknown): { change: SiteChange } | { error: object } {
  const shape = changeSchema.safeParse(body);
  if (!shape.success) return { error: errorBody('invalid_request', 'Invalid site content input') };
  const change = shape.data as SiteChange;
  const issues = validateSiteChange(change);
  if (issues.length > 0)
    return {
      error: { error: { code: 'invalid_content', message: '입력을 확인하세요.', issues } },
    };
  return { change };
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
