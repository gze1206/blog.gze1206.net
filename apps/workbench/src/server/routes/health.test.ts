import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ServerFileStore } from '../adapters/fileStore.js';
import { createApp } from '../app.js';
import { createHealthRoutes } from './health.js';

describe('GET /api/health', () => {
  it('reports only readiness and does not expose configuration values', async () => {
    const app = createHealthRoutes();

    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ready' });
  });

  it('is available from the assembled server application', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-health-'));
    const app = createApp(new ServerFileStore(root));

    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ready' });
  });
});
