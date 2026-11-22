import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const sha = (body: string) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`;

describe('csp', () => {
  it('NOR-201 AC-1: src 없는 실행 스크립트 본문만 해시한다', async () => {
    const mod = await import('./csp.ts');
    expect(mod).toHaveProperty('inlineScriptHashes');
    const html = [
      '<script>a()</script>',
      '<script type="module">b()</script>',
      '<script type="module" src="/x.js"></script>',
      '<script type="application/ld+json">{"a":1}</script>',
      '<script\n  is:inline>c()</script>',
    ].join('');
    expect(mod.inlineScriptHashes(html)).toEqual([sha('a()'), sha('b()'), sha('c()')]);
  });

  it('NOR-201 AC-2: 정책을 만들고 해시를 중복 없이 정렬해 script-src 에 넣는다', async () => {
    const mod = await import('./csp.ts');
    expect(mod).toHaveProperty('buildCsp');
    const policy: string = mod.buildCsp(["'sha256-b'", "'sha256-a'", "'sha256-b'"]);
    const directives = Object.fromEntries(
      policy.split(';').map((part) => {
        const [name, ...values] = part.trim().split(/\s+/u);
        return [name, values];
      }),
    );
    expect(directives['script-src']).toEqual([
      "'self'",
      "'wasm-unsafe-eval'",
      'https://comments.gze1206.net',
      'https://static.cloudflareinsights.com',
      'https://www.googletagmanager.com',
      "'sha256-a'",
      "'sha256-b'",
    ]);
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['object-src']).toEqual(["'none'"]);
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
    expect(directives['connect-src']).toContain('wss://comments.gze1206.net');
    // Cloudflare Pages 가 넣는 Web Analytics 비컨과 Comentario CSS 의 폰트 (실제 사이트 Report-Only 결과)
    expect(directives['connect-src']).toContain('https://cloudflareinsights.com');
    expect(directives['font-src']).toContain('https://comments.gze1206.net');
    expect(directives['frame-src']).toEqual(['https://www.youtube-nocookie.com']);
    expect(directives['img-src']).toContain('https://i.ytimg.com');
    expect(policy).not.toContain("'unsafe-eval'");
    expect(directives['script-src']).not.toContain("'unsafe-inline'");
  });

  it('NOR-234 AC-1: GA4 는 광고 기능 없는 Google 출처만 연다', async () => {
    const mod = await import('./csp.ts');
    const policy: string = mod.buildCsp([]);
    const directives = Object.fromEntries(
      policy.split(';').map((part) => {
        const [name, ...values] = part.trim().split(/\s+/u);
        return [name, values];
      }),
    );
    expect(directives['script-src']).toContain('https://www.googletagmanager.com');
    expect(directives['img-src']).toEqual(
      expect.arrayContaining([
        'https://www.googletagmanager.com',
        'https://*.google-analytics.com',
      ]),
    );
    expect(directives['connect-src']).toEqual(
      expect.arrayContaining([
        'https://www.googletagmanager.com',
        'https://*.google-analytics.com',
        'https://*.google.com',
      ]),
    );
    expect(policy).not.toMatch(/doubleclick|googlesyndication/u);
    expect(directives['frame-src']).toEqual(['https://www.youtube-nocookie.com']);
  });

  it('NOR-201 AC-3: Cloudflare Pages _headers 형식으로 쓴다', async () => {
    const mod = await import('./csp.ts');
    expect(mod).toHaveProperty('renderHeaders');
    expect(mod.renderHeaders("default-src 'self'", 'report-only')).toBe(
      "/*\n  Content-Security-Policy-Report-Only: default-src 'self'\n",
    );
    expect(mod.renderHeaders("default-src 'self'", 'enforce')).toBe(
      "/*\n  Content-Security-Policy: default-src 'self'\n",
    );
  });

  it('NOR-201 AC-6: 실제 사이트 확인을 마치고 강제한다', async () => {
    const mod = await import('./csp.ts');
    expect(mod).toHaveProperty('CSP_MODE');
    expect(mod.CSP_MODE).toBe('enforce');
  });
});
