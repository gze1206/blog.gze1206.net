import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import { ServerFileStore } from '../adapters/fileStore.js';

it('NOR-206 AC-4: 저장하지 않은 원본을 받아 html 과 warnings 를 돌려준다', async () => {
  const mod = await import('./preview.js');
  expect(mod).toHaveProperty('createPreviewRoutes');
  const root = await mkdtemp(path.join(tmpdir(), 'workbench-preview-'));
  const routes = mod.createPreviewRoutes(new ServerFileStore(root));
  const response = await routes.request('/api/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source: '# 안녕\n' }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { html: string; warnings: string[] };
  expect(body.html).toContain('안녕');
  expect(body.warnings).toEqual([]);
});
