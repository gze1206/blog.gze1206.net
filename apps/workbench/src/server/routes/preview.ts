import { Hono } from 'hono';
import { isBookId } from '@gze1206/content-contract';
import { z } from 'zod';

import type { BookDocument } from '../../core/document/document.js';
import type { FileStore } from '../../core/ports.js';
import { renderPreview } from '../../core/preview/render.js';

const inputSchema = z.object({ source: z.string().max(5_000_000) }).strict();

/** 문서 미리보기 (NOR-206). 저장하지 않은 원본도 받는다. 인용할 책은 작업 공간에서 읽는다. */
export function createPreviewRoutes(store: FileStore): Hono {
  const routes = new Hono();
  routes.post('/api/preview', async (context) => {
    const input = inputSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) {
      return context.json(
        { error: { code: 'invalid_request', message: '미리볼 원본이 올바르지 않습니다.' } },
        400,
      );
    }
    const books = new Map<string, BookDocument>();
    for (const match of input.data.source.matchAll(/\{%\s*bookquote\s+book="([^"\r\n]+)"/gu)) {
      const id = match[1];
      if (id === undefined || !isBookId(id) || books.has(id)) continue;
      try {
        const entry = await store.readDocument(`books/${id}.md`);
        if (entry.document.kind === 'book') books.set(id, entry.document as BookDocument);
      } catch {
        // 없는 책은 렌더러가 경고로 알린다.
      }
    }
    return context.json(renderPreview(input.data.source, { lookupBook: (id) => books.get(id) }));
  });
  return routes;
}
