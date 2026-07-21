import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGitHubRepo, parseRepoSlug } from './github-repo';

function apiResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const REPO_PAYLOAD = {
  full_name: 'withastro/astro',
  description: 'The web framework for content-driven websites.',
  stargazers_count: 12345,
  forks_count: 678,
  language: 'TypeScript',
  html_url: 'https://github.com/withastro/astro',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.GITHUB_TOKEN;
});

describe('parseRepoSlug', () => {
  it('owner/name 형식을 파싱한다', () => {
    expect(parseRepoSlug('withastro/astro')).toEqual({ owner: 'withastro', name: 'astro' });
    expect(parseRepoSlug('  gze1206/blog.gze1206.net  ')).toEqual({
      owner: 'gze1206',
      name: 'blog.gze1206.net',
    });
  });

  it('GitHub 전체 URL 도 허용한다', () => {
    expect(parseRepoSlug('https://github.com/withastro/astro')).toEqual({
      owner: 'withastro',
      name: 'astro',
    });
    expect(parseRepoSlug('https://github.com/withastro/astro/')).toEqual({
      owner: 'withastro',
      name: 'astro',
    });
    expect(parseRepoSlug('github.com/withastro/astro.git')).toEqual({
      owner: 'withastro',
      name: 'astro',
    });
  });

  it('잘못된 형식을 거부한다', () => {
    expect(parseRepoSlug('')).toBeNull();
    expect(parseRepoSlug('   ')).toBeNull();
    expect(parseRepoSlug('astro')).toBeNull();
    expect(parseRepoSlug('a/b/c')).toBeNull();
    expect(parseRepoSlug('with astro/astro')).toBeNull();
    expect(parseRepoSlug('withastro/')).toBeNull();
    expect(parseRepoSlug('/astro')).toBeNull();
    expect(parseRepoSlug('withastro/ast$ro')).toBeNull();
  });
});

describe('fetchGitHubRepo', () => {
  it('레포 메타를 정규화해 반환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => apiResponse(REPO_PAYLOAD)),
    );
    await expect(fetchGitHubRepo({ owner: 'withastro', name: 'astro' })).resolves.toEqual({
      fullName: 'withastro/astro',
      description: 'The web framework for content-driven websites.',
      stars: 12345,
      forks: 678,
      language: 'TypeScript',
      url: 'https://github.com/withastro/astro',
    });
  });

  it('올바른 REST 엔드포인트를 타임아웃과 함께 호출한다', async () => {
    const spy = vi.fn(async () => apiResponse(REPO_PAYLOAD));
    vi.stubGlobal('fetch', spy);
    await fetchGitHubRepo({ owner: 'withastro', name: 'astro' });
    expect(spy.mock.calls[0]?.[0]).toBe('https://api.github.com/repos/withastro/astro');
    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('GITHUB_TOKEN 이 있으면 Authorization 헤더를 붙인다', async () => {
    process.env.GITHUB_TOKEN = 'ghp_test';
    const spy = vi.fn(async () => apiResponse(REPO_PAYLOAD));
    vi.stubGlobal('fetch', spy);
    await fetchGitHubRepo({ owner: 'withastro', name: 'astro' });
    const headers = (spy.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as
      Record<string, string> | undefined;
    expect(headers?.authorization).toBe('Bearer ghp_test');
  });

  it('토큰이 없으면 Authorization 헤더를 붙이지 않는다', async () => {
    const spy = vi.fn(async () => apiResponse(REPO_PAYLOAD));
    vi.stubGlobal('fetch', spy);
    await fetchGitHubRepo({ owner: 'withastro', name: 'astro' });
    const headers = (spy.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as
      Record<string, string> | undefined;
    expect(headers?.authorization).toBeUndefined();
  });

  it('404 에서 예외 없이 null 을 반환한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => apiResponse({ message: 'Not Found' }, 404)),
    );
    await expect(fetchGitHubRepo({ owner: 'gze1206', name: 'does-not-exist' })).resolves.toBeNull();
  });

  it('rate limit(403) 에서 예외 없이 null 을 반환한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => apiResponse({ message: 'API rate limit exceeded' }, 403)),
    );
    await expect(fetchGitHubRepo({ owner: 'withastro', name: 'astro' })).resolves.toBeNull();
  });

  it('네트워크 오류에서 예외 없이 null 을 반환한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ETIMEDOUT');
      }),
    );
    await expect(fetchGitHubRepo({ owner: 'withastro', name: 'astro' })).resolves.toBeNull();
  });

  it('예상 밖의 응답 본문에서도 안전하게 null 을 반환한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<html>not json</html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      ),
    );
    await expect(fetchGitHubRepo({ owner: 'withastro', name: 'astro' })).resolves.toBeNull();
  });

  it('description/language 가 null 이어도 스타 수는 살린다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        apiResponse({ ...REPO_PAYLOAD, description: null, language: null, forks_count: 0 }),
      ),
    );
    await expect(fetchGitHubRepo({ owner: 'withastro', name: 'astro' })).resolves.toEqual({
      fullName: 'withastro/astro',
      description: undefined,
      stars: 12345,
      forks: 0,
      language: undefined,
      url: 'https://github.com/withastro/astro',
    });
  });
});
