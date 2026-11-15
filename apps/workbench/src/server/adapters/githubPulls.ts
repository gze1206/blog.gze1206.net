/**
 * 공개 블로그 저장소의 PR·검사 상태 조회 (NOR-228).
 *
 * 공개 저장소라 자격 증명 없이 GitHub REST API 를 쓴다(컨테이너에는 자격을 두지 않는다, ADR 0016).
 * 익명 한도는 시간당 60회이므로 브랜치마다 30초 동안 결과를 재사용하고, 실패도 그 동안 기억한다.
 * 실패·한도 초과는 `null` 이다 — 진행 표시는 "PR 여는 중" 으로 남을 뿐 발행에는 영향이 없다.
 */
import type { PullInfo } from '../../core/publishing/progress.js';

interface Options {
  /** `owner/name`. */
  readonly repo: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => number;
  readonly ttlMs?: number;
}

const API = 'https://api.github.com';
const FAILED = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure']);

export function createGitHubPullLookup(
  options: Options,
): (branch: string) => Promise<PullInfo | null> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const ttl = options.ttlMs ?? 30_000;
  const owner = options.repo.split('/')[0] ?? '';
  const cache = new Map<string, { at: number; value: Promise<PullInfo | null> }>();

  const get = async (pathname: string, search: Record<string, string> = {}): Promise<unknown> => {
    const url = new URL(`${API}${pathname}`);
    for (const [key, value] of Object.entries(search)) url.searchParams.set(key, value);
    const response = await fetcher(url, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'workbench' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    return response.json();
  };

  const lookup = async (branch: string): Promise<PullInfo | null> => {
    try {
      const pulls = await get(`/repos/${options.repo}/pulls`, {
        head: `${owner}:${branch}`,
        state: 'all',
      });
      const pull = Array.isArray(pulls)
        ? (pulls[0] as Record<string, unknown> | undefined)
        : undefined;
      if (!pull || typeof pull.number !== 'number' || typeof pull.html_url !== 'string')
        return null;
      const merged = typeof pull.merged_at === 'string';
      const state = pull.state === 'closed' ? 'closed' : 'open';
      const info = { number: pull.number, url: pull.html_url, state, merged } as const;
      if (merged) return { ...info, checks: 'success' };
      const sha = (pull.head as { sha?: unknown } | undefined)?.sha;
      if (typeof sha !== 'string' || !/^[0-9a-f]{7,64}$/u.test(sha))
        return { ...info, checks: 'pending' };
      const result = (await get(`/repos/${options.repo}/commits/${sha}/check-runs`, {
        per_page: '100',
      })) as { check_runs?: { status?: unknown; conclusion?: unknown }[] };
      const runs = Array.isArray(result.check_runs) ? result.check_runs : [];
      const checks = runs.some((run) => FAILED.has(String(run.conclusion)))
        ? 'failure'
        : runs.length === 0 || runs.some((run) => run.status !== 'completed')
          ? 'pending'
          : 'success';
      return { ...info, checks };
    } catch {
      return null;
    }
  };

  return (branch) => {
    const cached = cache.get(branch);
    if (cached && now() - cached.at < ttl) return cached.value;
    const value = lookup(branch);
    cache.set(branch, { at: now(), value });
    return value;
  };
}
