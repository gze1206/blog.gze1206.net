import { describe, expect, it } from 'vitest';

type Route = { status: number; location?: string; body?: string };

function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: string; redirect: RequestInit['redirect'] }[] = [];
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
  probes: ['/', '/blog/hello/?ref=check'],
  hostileProbes: ['//evil.example/x?next=https://evil.example'],
  legacyPaths: ['/blog/hello/'],
  services: ['https://comments.gze1206.net/comentario.js'],
};

const canonicalPage =
  '<html><head><link rel="canonical" href="https://gze1206.net/"></head></html>';

function healthyRoutes(): Record<string, Route> {
  const routes: Record<string, Route> = {
    'https://gze1206.net/': { status: 200, body: canonicalPage },
    'https://gze1206.net/blog/hello/': { status: 200 },
    'https://comments.gze1206.net/comentario.js': { status: 200 },
  };
  for (const alias of ['https://www.gze1206.net', 'https://blog.gze1206.net']) {
    routes[`${alias}/`] = { status: 301, location: 'https://gze1206.net/' };
    routes[`${alias}/blog/hello/?ref=check`] = {
      status: 301,
      location: 'https://gze1206.net/blog/hello/?ref=check',
    };
    // Cloudflare 는 `//` 를 `/` 로 정규화한다. 정본 origin 에 머물면 통과다.
    routes[`${alias}//evil.example/x?next=https://evil.example`] = {
      status: 301,
      location: 'https://gze1206.net/evil.example/x?next=https://evil.example',
    };
  }
  return routes;
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
    expect(failures).toHaveLength(9);
  });

  it('NOR-199 AC-7: 네트워크 오류(DNS 실패 등)도 던지지 않고 실패 항목으로 모은다', async () => {
    const mod = await import('./check.ts');
    expect(mod).toHaveProperty('checkDomains');
    const rejecting = async (input: string): Promise<Response> => {
      throw new Error(`fetch failed: ${input}`);
    };
    await expect(mod.checkDomains(rejecting, options)).resolves.toHaveLength(9);
    const failures = await mod.checkDomains(rejecting, options);
    expect(failures[0]).toContain('fetch failed');
  });

  it('NOR-199 AC-5: 확인 경로마다 이전 호스트의 301 을 확인한다', async () => {
    const mod = await import('./check.ts');
    expect(mod).toHaveProperty('checkDomains');
    const routes = healthyRoutes();
    routes['https://blog.gze1206.net/'] = { status: 200 };
    const failures = await mod.checkDomains(fakeFetch(routes).fetchFn, options);
    expect(failures).toEqual([expect.stringContaining('https://blog.gze1206.net/')]);
  });

  it('NOR-199 AC-8: 악의적인 경로의 Location 은 정본 origin 에 머물러야 한다', async () => {
    const mod = await import('./check.ts');
    expect(mod).toHaveProperty('checkDomains');
    const healthy = fakeFetch(healthyRoutes());
    expect(await mod.checkDomains(healthy.fetchFn, options)).toEqual([]);
    expect(healthy.calls.map((call) => call.url)).toContain(
      'https://www.gze1206.net//evil.example/x?next=https://evil.example',
    );
    for (const location of ['https://evil.example/x', '//evil.example/x', 'http://gze1206.net/x']) {
      const routes = healthyRoutes();
      routes['https://www.gze1206.net//evil.example/x?next=https://evil.example'] = {
        status: 301,
        location,
      };
      const failures = await mod.checkDomains(fakeFetch(routes).fetchFn, options);
      expect(failures).toEqual([expect.stringContaining('www.gze1206.net//evil.example')]);
    }
  });

  it('NOR-199 AC-7: 해석할 수 없는 Location·canonical 도 실패로 남기고 계속한다', async () => {
    const mod = await import('./check.ts');
    expect(mod).toHaveProperty('checkDomains');
    const routes = healthyRoutes();
    routes['https://gze1206.net/'] = {
      status: 200,
      body: '<link rel="canonical" href="http://[">',
    };
    routes['https://www.gze1206.net/'] = { status: 301, location: 'http://[' };
    const run = mod.checkDomains(fakeFetch(routes).fetchFn, options);
    await expect(run).resolves.toHaveLength(2);
  });

  it('NOR-200 AC-10: services 의 URL 도 200 이어야 한다', async () => {
    const mod = await import('./check.ts');
    expect(mod).toHaveProperty('checkDomains');
    const routes = healthyRoutes();
    routes['https://comments.gze1206.net/comentario.js'] = { status: 502 };
    const failures = await mod.checkDomains(fakeFetch(routes).fetchFn, options);
    expect(failures).toEqual([expect.stringContaining('comments.gze1206.net')]);
  });
});
