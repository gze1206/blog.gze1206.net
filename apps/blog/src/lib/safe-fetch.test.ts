import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';

describe('safe-fetch', () => {
  it('NOR-211 AC-1: 공개 주소가 아닌 IP 를 가려낸다', async () => {
    const mod = await import('./safe-fetch.ts');
    expect(mod).toHaveProperty('isPublicAddress');
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '::1',
      '::',
      'fe80::1',
      'fc00::1',
      'fd12:3456::1',
      '::ffff:127.0.0.1',
      '::ffff:10.0.0.1',
    ])
      expect(mod.isPublicAddress(ip), ip).toBe(false);
    for (const ip of ['93.184.216.34', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111'])
      expect(mod.isPublicAddress(ip), ip).toBe(true);
  });

  it('NOR-211 AC-2: localhost 처럼 내부로 해석되는 호스트에는 연결하지 않는다', async () => {
    const mod = await import('./safe-fetch.ts');
    expect(mod).toHaveProperty('safeFetch');
    let hits = 0;
    const server = createServer((_req, res) => {
      hits += 1;
      res.end('<html></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      await expect(mod.safeFetch(`http://localhost:${port}/`)).rejects.toThrow();
      expect(hits).toBe(0);
    } finally {
      server.close();
    }
  });

  it('NOR-211 AC-3: 내부 IP·다른 스킴으로의 리디렉션과 과한 리디렉션을 따라가지 않는다', async () => {
    const mod = await import('./safe-fetch.ts');
    expect(mod).toHaveProperty('safeFetch');
    const calls: string[] = [];
    const redirectTo = (location: string) => async (url: string) => {
      calls.push(url);
      return new Response(null, { status: 302, headers: { location } });
    };
    for (const location of [
      'http://169.254.169.254/latest',
      'file:///etc/passwd',
      'http://[::1]/',
    ]) {
      calls.length = 0;
      await expect(
        mod.safeFetch('https://example.com/a', {}, { fetchImpl: redirectTo(location) }),
      ).rejects.toThrow();
      expect(calls).toEqual(['https://example.com/a']);
    }
    calls.length = 0;
    await expect(
      mod.safeFetch(
        'https://example.com/a',
        {},
        { fetchImpl: redirectTo('https://example.com/b') },
      ),
    ).rejects.toThrow();
    expect(calls).toHaveLength(4);
  });
});
