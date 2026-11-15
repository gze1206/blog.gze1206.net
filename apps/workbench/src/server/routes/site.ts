import { Hono } from 'hono';
import { z } from 'zod';

import type { PublicBlogPublisher } from '../adapters/publicBlog.js';
import {
  SITE_COLLECTION_NAMES,
  validateSiteChange,
  type SiteChange,
} from '../../core/site/siteContent.js';

type SitePublisher = Required<Pick<PublicBlogPublisher, 'listSite' | 'reviewSite' | 'publishSite'>>;

const collectionSchema = z.enum(SITE_COLLECTION_NAMES as [string, ...string[]]);
const idSchema = z.string().min(1).max(80);
const changeSchema = z.union([
  z
    .object({
      collection: collectionSchema,
      id: idSchema,
      data: z.record(z.string(), z.unknown()),
    })
    .strict(),
  z.object({ collection: collectionSchema, id: idSchema, delete: z.literal(true) }).strict(),
]);
const opaqueIdSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);

/** 사이트 콘텐츠 편집·발행 (NOR-208). 원본은 공개 저장소의 JSON 이다. */
export function createSiteRoutes(publisher: SitePublisher): Hono {
  const routes = new Hono();

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
