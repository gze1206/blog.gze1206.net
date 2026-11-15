/**
 * 공개 블로그 저장소의 PR·검사 상태 조회 (NOR-228).
 *
 * 공개 저장소라 자격 증명 없이 GitHub REST API 를 쓴다(컨테이너에는 자격을 두지 않는다, ADR 0016).
 * 익명 한도는 시간당 60회다. 그래서
 * - 브랜치마다 60초 동안 결과를 재사용하고,
 * - 남은 횟수가 10 이하이면 초기화 시각까지 아무것도 묻지 않으며,
 * - 조회가 실패하면 마지막으로 받은 결과를 쓴다(없으면 `null`, 진행 표시는 "PR 여는 중" 에 머문다).
 */
import type { PullInfo } from '../../core/publishing/progress.js';

interface Options {
  /** `owner/name`. 설정에서 검증한 값이다. */
  readonly repo: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => number;
  readonly ttlMs?: number;
}

const API = 'https://api.github.com';
const FAILED = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure']);
const LOW_REMAINING = 10;
const MAX_CACHE = 100;

export function createGitHubPullLookup(
  options: Options,
): (branch: string) => Promise<PullInfo | null> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const ttl = options.ttlMs ?? 60_000;
  const owner = options.repo.split('/')[0] ?? '';
  const pullUrl = new RegExp(
    `^https://github\\.com/${options.repo.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}/pull/\\d+$`,
    'u',
  );
  const cache = new Map<string, { at: number; value: Promise<PullInfo | null> }>();
  const lastGood = new Map<string, PullInfo>();
  /** 한도가 거의 찼을 때 다시 물어도 되는 시각(ms). */
  let blockedUntil = 0;

  const get = async (pathname: string, search: Record<string, string>): Promise<unknown> => {
    const url = new URL(`${API}${pathname}`);
    for (const [key, value] of Object.entries(search)) url.searchParams.set(key, value);
    const response = await fetcher(url, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'workbench' },
      signal: AbortSignal.timeout(5000),
    });
    const remaining = Number(response.headers.get('x-ratelimit-remaining'));
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    if (response.headers.has('x-ratelimit-remaining') && remaining <= LOW_REMAINING)
      blockedUntil = Number.isFinite(reset) ? reset * 1000 : now() + 15 * 60_000;
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    return response.json();
  };

  const lookup = async (branch: string): Promise<PullInfo | null> => {
    const pulls = await get(`/repos/${options.repo}/pulls`, {
      head: `${owner}:${branch}`,
      state: 'all',
      sort: 'created',
      direction: 'desc',
    });
    const list = Array.isArray(pulls) ? (pulls as Record<string, unknown>[]) : [];
    const pull = list.find((item) => item.state === 'open') ?? list[0];
    if (!pull || typeof pull.number !== 'number' || typeof pull.html_url !== 'string') return null;
    // 링크로 그릴 주소다. 설정한 저장소의 PR 이 아니면 믿지 않는다.
    if (!pullUrl.test(pull.html_url)) return null;
    const merged = typeof pull.merged_at === 'string';
    const state = pull.state === 'closed' ? 'closed' : 'open';
    const info = { number: pull.number, url: pull.html_url, state, merged } as const;
    if (merged) return { ...info, checks: 'success' };
    const sha = (pull.head as { sha?: unknown } | undefined)?.sha;
    if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/u.test(sha))
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
  };

  const prune = () => {
    for (const [key, entry] of cache) if (now() - entry.at >= ttl) cache.delete(key);
    while (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  };

  return (branch) => {
    const cached = cache.get(branch);
    if (cached && now() - cached.at < ttl) return cached.value;
    if (now() < blockedUntil) return Promise.resolve(lastGood.get(branch) ?? null);
    prune();
    const value = lookup(branch).then(
      (info) => {
        if (info) lastGood.set(branch, info);
        else lastGood.delete(branch);
        return info;
      },
      () => lastGood.get(branch) ?? null,
    );
    cache.set(branch, { at: now(), value });
    return value;
  };
}
