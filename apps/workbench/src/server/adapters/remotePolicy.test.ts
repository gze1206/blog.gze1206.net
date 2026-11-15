import { describe, expect, it } from 'vitest';

import { ProductionRemotePolicy } from './remotePolicy.js';

describe('ProductionRemotePolicy', () => {
  const policy = new ProductionRemotePolicy({
    allowedHost: 'github.com',
    expectedPath: '/gze1206/blog.gze1206.net.git',
  });

  it('allows only the configured HTTPS origin and returns hardened clone configuration', () => {
    const config = policy.cloneConfig('https://github.com/gze1206/blog.gze1206.net.git');

    expect(config.effectiveUrl).toBe('https://github.com/gze1206/blog.gze1206.net.git');
    expect(config.gitConfigArgs).toEqual(
      expect.arrayContaining([
        'protocol.allow=never',
        'protocol.https.allow=always',
        'http.followRedirects=false',
      ]),
    );
  });

  it.each([
    'file:///tmp/blog.git',
    'ssh://github.com/gze1206/blog.gze1206.net.git',
    'git://github.com/gze1206/blog.gze1206.net.git',
    'https://127.0.0.1/gze1206/blog.gze1206.net.git',
    'https://github.com:444/gze1206/blog.gze1206.net.git',
    'https://user@github.com/gze1206/blog.gze1206.net.git',
    'https://github.com/gze1206/blog.gze1206.net.git?ref=main',
    'https://github.com/gze1206/blog.gze1206.net.git#main',
    'https://github.com/gze1206/another.git',
  ])('rejects disallowed remote %s', (remote) => {
    expect(() => policy.assertAllowed(remote)).toThrow(/not allowed/u);
  });
});
