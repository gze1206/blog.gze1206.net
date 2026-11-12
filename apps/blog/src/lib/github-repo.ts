/**
 * GitHub 레포 카드(`{% github %}`)용 메타 취득.
 *
 * **빌드타임 전용**이다(ADR 0008). 어떤 실패도 예외로 전파하지 않고 `null` 을 반환한다.
 * `GITHUB_TOKEN` 이 있으면 인증(5,000 req/h)으로, 없으면 미인증(60 req/h)으로 동작한다.
 */

const TIMEOUT_MS = 5_000;
const USER_AGENT = 'blog.gze1206.net github-card (+https://gze1206.net)';

/** GitHub 사용자/레포 이름에 허용되는 문자. */
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

export interface RepoSlug {
  owner: string;
  name: string;
}

export interface GitHubRepoMeta {
  fullName: string;
  description?: string;
  stars: number;
  forks: number;
  language?: string;
  url: string;
}

/**
 * `owner/name` 또는 GitHub URL 을 파싱한다. 형식이 어긋나면 `null`.
 *
 * 허용: `withastro/astro`, `https://github.com/withastro/astro`, `github.com/withastro/astro.git`
 */
export function parseRepoSlug(input: string): RepoSlug | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const fromUrl = /^(?:https?:\/\/)?(?:www\.)?github\.com\/(.+)$/i.exec(trimmed);
  const path = (fromUrl?.[1] ?? trimmed).replace(/\.git$/i, '').replace(/\/+$/, '');

  const parts = path.split('/');
  if (parts.length !== 2) return null;

  const [owner, name] = parts as [string, string];
  if (!SEGMENT_RE.test(owner) || !SEGMENT_RE.test(name)) return null;

  return { owner, name };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function warn(slug: RepoSlug, reason: string): void {
  console.warn(
    `[blocks] github 메타 취득 실패 — ${reason} (${slug.owner}/${slug.name}). 폴백으로 렌더합니다.`,
  );
}

/** GitHub REST API 로 레포 메타를 가져온다. 실패 시 경고만 남기고 `null`. */
export async function fetchGitHubRepo(slug: RepoSlug): Promise<GitHubRepoMeta | null> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': USER_AGENT,
  };
  // 토큰이 없어도 미인증으로 동작한다. 한도에 걸리면 폴백이 받아준다.
  if (token) headers.authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`https://api.github.com/repos/${slug.owner}/${slug.name}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers,
    });

    if (!response.ok) {
      warn(
        slug,
        response.status === 403 ? 'rate limit 또는 접근 거부 (403)' : `HTTP ${response.status}`,
      );
      return null;
    }

    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null) {
      warn(slug, '예상 밖의 응답 본문');
      return null;
    }

    const data = payload as Record<string, unknown>;
    const fullName = optionalString(data.full_name) ?? `${slug.owner}/${slug.name}`;

    return {
      fullName,
      description: optionalString(data.description),
      stars: count(data.stargazers_count),
      forks: count(data.forks_count),
      language: optionalString(data.language),
      url: optionalString(data.html_url) ?? `https://github.com/${fullName}`,
    };
  } catch (error) {
    warn(slug, error instanceof Error ? error.message : String(error));
    return null;
  }
}
