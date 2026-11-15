import { Hono } from 'hono';

import type { DocumentTrash, FileStore } from '../../core/ports.js';
import { TrashConflictError } from '../../core/ports.js';
import { encodeDocumentId, isDocumentId } from '../documentIds.js';

/** 문서 삭제와 휴지통 (NOR-205). 삭제는 휴지통으로 옮기는 것이다. */
export function createTrashRoutes(store: FileStore & DocumentTrash): Hono {
  const routes = new Hono();

  routes.delete('/api/documents/:id', async (context) => {
    const id = context.req.param('id');
    if (!isDocumentId(id))
      return context.json(errorBody('invalid_id', '문서 id 가 올바르지 않습니다.'), 400);
    const { documents } = await store.listDocuments();
    const found = documents.find(({ relativePath }) => encodeDocumentId(relativePath) === id);
    if (found === undefined)
      return context.json(errorBody('not_found', '문서를 찾지 못했습니다.'), 404);
    return context.json(await store.trashDocument(found.relativePath));
  });

  routes.get('/api/trash', async (context) => context.json({ items: await store.listTrash() }));

  routes.post('/api/trash/:id/restore', async (context) => {
    try {
      const relativePath = await store.restoreTrash(context.req.param('id'));
      return context.json({ id: encodeDocumentId(relativePath), relativePath });
    } catch (error) {
      if (error instanceof TrashConflictError)
        return context.json(errorBody('conflict', error.message), 409);
      return context.json(errorBody('not_found', '휴지통에서 찾지 못했습니다.'), 404);
    }
  });

  routes.delete('/api/trash/:id', async (context) => {
    try {
      await store.purgeTrash(context.req.param('id'));
      return context.json({ ok: true });
    } catch {
      return context.json(errorBody('not_found', '휴지통에서 찾지 못했습니다.'), 404);
    }
  });

  return routes;
}

function errorBody(code: string, message: string) {
  return { error: { code, message } };
}
