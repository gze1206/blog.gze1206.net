import { describe, expect, it } from 'vitest';

import { createGitHubPullLookup } from './githubPulls.js';

type Route = (url: URL) => unknown;

function fakeFetch(route: Route) {
  const calls: string[] = [];
  const fetch = async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}${url.search}`);
    const body = route(url);
    if (body instanceof Error) throw body;
    if (typeof body === 'number') return new Response('{}', { status: body });
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

const pr = (overrides: Record<string, unknown> = {}) => ({
  number: 76,
  html_url: 'https://github.com/o/r/pull/76',
  state: 'open',
  merged_at: null,
  head: { sha: '26800b3ec290450842a624635421f5739ab7f946' },
  ...overrides,
});

describe('GitHub PR 조회 (NOR-228)', () => {
  it('NOR-228 AC-3: PR 상태와 검사 결과를 돌려준다', async () => {
    const { fetch, calls } = fakeFetch((url) =>
      url.pathname.endsWith('/pulls')
        ? [pr()]
        : {
            check_runs: [
              { status: 'completed', conclusion: 'success' },
              { status: 'in_progress', conclusion: null },
            ],
          },
    );
    const lookup = createGitHubPullLookup({ repo: 'o/r', fetch });
    await expect(lookup('content/a')).resolves.toEqual({
      number: 76,
      url: 'https://github.com/o/r/pull/76',
      state: 'open',
      merged: false,
      checks: 'pending',
    });
    expect(calls[0]).toBe('/repos/o/r/pulls?head=o%3Acontent%2Fa&state=all');
    expect(calls[1]).toBe(
      '/repos/o/r/commits/26800b3ec290450842a624635421f5739ab7f946/check-runs?per_page=100',
    );
  });

  it('NOR-228 AC-3: 실패한 검사는 failure, 모두 통과면 success, 병합되면 검사를 묻지 않는다', async () => {
    const failed = createGitHubPullLookup({
      repo: 'o/r',
      fetch: fakeFetch((url) =>
        url.pathname.endsWith('/pulls')
          ? [pr()]
          : {
              check_runs: [
                { status: 'completed', conclusion: 'success' },
                { status: 'completed', conclusion: 'failure' },
              ],
            },
      ).fetch,
    });
    await expect(failed('content/a')).resolves.toMatchObject({ checks: 'failure' });
    const merged = fakeFetch(() => [pr({ state: 'closed', merged_at: '2026-11-15T00:00:00Z' })]);
    await expect(
      createGitHubPullLookup({ repo: 'o/r', fetch: merged.fetch })('content/a'),
    ).resolves.toMatchObject({ merged: true, checks: 'success' });
    expect(merged.calls).toHaveLength(1);
  });

  it('NOR-228 AC-3: 같은 브랜치는 30초 안에 다시 묻지 않고, 실패하면 null 이다', async () => {
    let now = 0;
    const { fetch, calls } = fakeFetch((url) =>
      url.pathname.endsWith('/pulls') ? [] : { check_runs: [] },
    );
    const lookup = createGitHubPullLookup({ repo: 'o/r', fetch, now: () => now });
    await expect(lookup('content/a')).resolves.toBeNull();
    await lookup('content/a');
    expect(calls).toHaveLength(1);
    now = 31_000;
    await lookup('content/a');
    expect(calls).toHaveLength(2);
    const broken = createGitHubPullLookup({ repo: 'o/r', fetch: fakeFetch(() => 403).fetch });
    await expect(broken('content/a')).resolves.toBeNull();
    const offline = createGitHubPullLookup({
      repo: 'o/r',
      fetch: fakeFetch(() => new Error('offline')).fetch,
    });
    await expect(offline('content/a')).resolves.toBeNull();
  });
});
