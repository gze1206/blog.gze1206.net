import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ServerFileStore } from '../adapters/fileStore.js';
import { encodeDocumentId } from '../documentIds.js';

describe('휴지통 API', () => {
  it('NOR-205 AC-4: 지우고, 휴지통을 보고, 복원하고, 비운다', async () => {
    const mod = await import('./trash.js');
    expect(mod).toHaveProperty('createTrashRoutes');
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-trash-api-'));
    await mkdir(path.join(root, 'drafts'));
    const source =
      '---\ntitle: 글\nkind: private-post\ncreatedAt: 2026-11-15\nupdatedAt: 2026-11-15\n---\n';
    await writeFile(path.join(root, 'drafts', 'a.md'), source);
    const routes = mod.createTrashRoutes(new ServerFileStore(root));
    const id = encodeDocumentId('drafts/a.md');

    expect((await routes.request(`/api/documents/${id}`, { method: 'DELETE' })).status).toBe(200);
    const listed = (await (await routes.request('/api/trash')).json()) as {
      items: { id: string; relativePath: string }[];
    };
    expect(listed.items.map((item) => item.relativePath)).toEqual(['drafts/a.md']);
    const trashId = listed.items[0]?.id ?? '';

    expect((await routes.request(`/api/trash/${trashId}/restore`, { method: 'POST' })).status).toBe(
      200,
    );
    expect((await routes.request(`/api/documents/${id}`, { method: 'DELETE' })).status).toBe(200);
    await writeFile(path.join(root, 'drafts', 'a.md'), source);
    const again = (await (await routes.request('/api/trash')).json()) as {
      items: { id: string }[];
    };
    expect(
      (await routes.request(`/api/trash/${again.items[0]?.id ?? ''}/restore`, { method: 'POST' }))
        .status,
    ).toBe(409);
    expect(
      (await routes.request(`/api/trash/${again.items[0]?.id ?? ''}`, { method: 'DELETE' })).status,
    ).toBe(200);
    expect(
      ((await (await routes.request('/api/trash')).json()) as { items: unknown[] }).items,
    ).toEqual([]);
  });
});
