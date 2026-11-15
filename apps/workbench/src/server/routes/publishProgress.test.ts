import { describe, expect, it } from 'vitest';

import { createPublishProgressRoutes } from './publishProgress.js';

describe('GET /api/publish/progress (NOR-228)', () => {
  const routes = createPublishProgressRoutes({
    readLedger: async () => 'a.json ok content/a\nb.json rejected bad-tree\n',
    lookupPull: async (branch) =>
      branch === 'content/a'
        ? {
            number: 3,
            url: 'https://github.com/o/r/pull/3',
            state: 'open',
            merged: false,
            checks: 'pending',
          }
        : null,
  });

  it('NOR-228 AC-4: 이름마다 단계를 돌려준다', async () => {
    const response = await routes.request('/api/publish/progress?ref=a.json&ref=b.json&ref=c.json');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      progress: [
        {
          ref: 'a.json',
          stage: 'checking',
          branch: 'content/a',
          pull: { number: 3, url: 'https://github.com/o/r/pull/3' },
        },
        { ref: 'b.json', stage: 'rejected', reason: 'bad-tree' },
        { ref: 'c.json', stage: 'queued' },
      ],
    });
  });

  it('NOR-228 AC-4: 이름 규칙에 맞지 않거나 10개를 넘으면 400 이다', async () => {
    expect((await routes.request('/api/publish/progress?ref=../x.json')).status).toBe(400);
    expect((await routes.request('/api/publish/progress?ref=a.txt')).status).toBe(400);
    expect((await routes.request('/api/publish/progress')).status).toBe(400);
    const many = Array.from({ length: 11 }, (_, index) => `ref=r${index}.json`).join('&');
    expect((await routes.request(`/api/publish/progress?${many}`)).status).toBe(400);
  });

  it('NOR-228 AC-4: ledger 를 읽지 못하면 모두 queued 로 둔다', async () => {
    const offline = createPublishProgressRoutes({
      readLedger: async () => {
        throw new Error('missing');
      },
      lookupPull: async () => null,
    });
    const response = await offline.request('/api/publish/progress?ref=a.json');
    expect(await response.json()).toEqual({ progress: [{ ref: 'a.json', stage: 'queued' }] });
  });
});
