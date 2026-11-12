import { describe, expect, it } from 'vitest';

type Route = { status: number; location?: string; body?: string };

function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: string; redirect: RequestRedirect | undefined }[] = [];
  const fetchFn = async (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: input, redirect: init?.redirect });
    const route = routes[input] ?? { status: 404 };
    const headers = new Headers(route.location ? { location: route.location } : {});
    return new Response(route.body ?? '', { status: route.status, headers });
  };
  return { fetchFn, calls };
}

const options = {
  canonical: 'https://gze1206.net',
  aliases: ['www.gze1206.net', 'blog.gze1206.net'],
  probe: '/blog/hello/?ref=check',
  legacyPaths: ['/blog/hello/'],
};

const canonicalPage =
  '<html><head><link rel="canonical" href="https://gze1206.net/"></head></html>';

function healthyRoutes(): Record<string, Route> {
  return {
    'https://gze1206.net/': { status: 200, body: canonicalPage },
    'https://www.gze1206.net/blog/hello/?ref=check': {
      status: 301,
      location: 'https://gze1206.net/blog/hello/?ref=check',
    },
    'https://blog.gze1206.net/blog/hello/?ref=check': {
      status: 301,
      location: 'https://gze1206.net/blog/hello/?ref=check',
    },
    'https://gze1206.net/blog/hello/': { status: 200 },
  };
}

describe('checkDomains', () => {
  it('NOR-199 AC-4: 정본이 200 이고 canonical 이 정본 호스트를 가리켜야 통과한다', async () => {
    const mod = await import('./check.ts');
    expect(mod).toHaveProperty('checkDomains');
    const healthy = fakeFetch(healthyRoutes());
    expect(await mod.checkDomains(healthy.fetchFn, options)).toEqual([]);
    expect(healthy.calls.every((call) => call.redirect === 'manual')).toBe(true);

    const wrongCanonical = healthyRoutes();
    wrongCanonical['https://gze1206.net/'] = {
      status: 200,
      body: '<link href="https://blog.gze1206.net/" rel="canonical">',
    };
    expect(await mod.checkDomains(fakeFetch(wrongCanonical).fetchFn, options)).toHaveLength(1);

    const down = healthyRoutes();
    down['https://gze1206.net/'] = { status: 526 };
    expect(await mod.checkDomains(fakeFetch(down).fetchFn, options)).toHaveLength(1);
  });

  it('NOR-199 AC-5: 이전 호스트는 경로·쿼리를 보존한 301 이어야 한다', async () => {
    const mod = await import('./check.ts');
    expect(mod).toHaveProperty('checkDomains');
    const cases: Route[] = [
      { status: 302, location: 'https://gze1206.net/blog/hello/?ref=check' },
      { status: 301, location: 'https://gze1206.net/' },
      { status: 301, location: 'https://gze1206.net/blog/hello/' },
      { status: 301, location: 'https://evil.example/blog/hello/?ref=check' },
      { status: 200 },
    ];
    for (const route of cases) {
      const routes = healthyRoutes();
      routes['https://www.gze1206.net/blog/hello/?ref=check'] = route;
      const failures = await mod.checkDomains(fakeFetch(routes).fetchFn, options);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain('www.gze1206.net');
    }
  });

  it('NOR-199 AC-6: 옛 sitemap 경로는 정본 호스트에서 200 이어야 한다', async () => {
    const mod = await import('./check.ts');
    expect(mod).toHaveProperty('checkDomains');
    const routes = healthyRoutes();
    routes['https://gze1206.net/blog/hello/'] = { status: 404 };
    const failures = await mod.checkDomains(fakeFetch(routes).fetchFn, options);
    expect(failures).toEqual([expect.stringContaining('/blog/hello/')]);
  });

  it('NOR-199 AC-6: 옛 경로 목록 파일이 비어 있지 않고 모두 절대 경로다', async () => {
    const mod = await import('./check.ts');
    expect(mod).toHaveProperty('readLegacyPaths');
    const paths = await mod.readLegacyPaths();
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((p: string) => p.startsWith('/'))).toBe(true);
  });

  it('NOR-199 AC-7: 실패를 모두 모아서 돌려준다', async () => {
    const mod = await import('./check.ts');
    expect(mod).toHaveProperty('checkDomains');
    const failures = await mod.checkDomains(fakeFetch({}).fetchFn, options);
    expect(failures).toHaveLength(4);
  });
});
