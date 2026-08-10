import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  environmentReads: [] as string[],
}));

vi.mock('cloudflare:workers', () => ({
  env: new Proxy(
    {
      KEYSTATIC_GITHUB_CLIENT_ID: 'test-client-id',
      KEYSTATIC_GITHUB_CLIENT_SECRET: 'test-client-secret',
      KEYSTATIC_SECRET: 'test-secret',
    },
    {
      get(target, property) {
        if (typeof property === 'string') {
          state.environmentReads.push(property);
        }

        return Reflect.get(target, property);
      },
    },
  ),
}));

vi.mock('@keystatic/core/api/generic', () => ({
  makeGenericAPIRouteHandler: () => async () => ({
    body: 'handled by Keystatic',
    headers: { 'content-type': 'text/plain' },
    status: 201,
  }),
}));

describe('Keystatic Worker API route', () => {
  it('reads Worker secrets only while handling an API request', async () => {
    const route = await import('../pages/api/keystatic/[...params]');

    expect(state.environmentReads).toEqual([]);

    const response = await route.ALL({
      request: new Request('https://gze1206.net/api/keystatic/test'),
    } as Parameters<typeof route.ALL>[0]);

    expect(response.status).toBe(201);
    await expect(response.text()).resolves.toBe('handled by Keystatic');
    expect(state.environmentReads).toEqual([
      'KEYSTATIC_GITHUB_CLIENT_ID',
      'KEYSTATIC_GITHUB_CLIENT_SECRET',
      'KEYSTATIC_SECRET',
    ]);
  });
});
