import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/** 런칭 직후와 이후 회귀에서 같은 기준으로 공개 도메인을 확인한다 (NOR-199). */
export interface DomainCheckOptions {
  /** 정본 origin. 예: `https://gze1206.net` */
  canonical: string;
  /** 정본으로 301 해야 하는 이전 호스트 이름 */
  aliases: readonly string[];
  /** 이전 호스트에서 경로·쿼리 보존을 확인할 경로. 예: `/`, `/blog/x/?ref=check` */
  probes: readonly string[];
  /** 이전 호스트에 보내는 악의적인 경로. `Location` 이 정본 origin 에 머무는지만 본다 */
  hostileProbes: readonly string[];
  /** 정본 호스트에서 200 이어야 하는 옛 사이트 경로 */
  legacyPaths: readonly string[];
  /** 200 이어야 하는 다른 서비스. `integrity` 가 있으면 본문 sha384 도 대조한다 (NOR-200) */
  services: readonly ServiceCheck[];
}

export interface ServiceCheck {
  url: string;
  /** SRI 형식 `sha384-<base64>` */
  integrity?: string;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const CANONICAL_LINK = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i;
const HREF = /\bhref=["']([^"']+)["']/i;

/** 해석할 수 없으면 undefined. 서버가 돌려준 값은 믿지 않는다. */
function parseUrl(value: string, base: string): URL | undefined {
  try {
    return new URL(value, base);
  } catch {
    return undefined;
  }
}

/** 실패 항목을 모두 돌려준다. 빈 배열이면 통과다. 리다이렉트는 따라가지 않는다. */
export async function checkDomains(
  fetchFn: FetchLike,
  options: DomainCheckOptions,
): Promise<string[]> {
  const failures: string[] = [];
  // 네트워크 오류(DNS 실패 등)는 던지지 않고 실패 항목으로 남긴다. 나머지 항목도 계속 확인한다.
  const get = async (url: string): Promise<Response | undefined> => {
    try {
      return await fetchFn(url, { redirect: 'manual' });
    } catch (error) {
      failures.push(`${url}: 요청 실패 (${describeError(error)})`);
      return undefined;
    }
  };
  const canonicalOrigin = new URL(options.canonical).origin;

  const home = await get(`${canonicalOrigin}/`);
  if (home !== undefined && home.status !== 200) {
    failures.push(`${canonicalOrigin}/: 200 이 아니라 ${home.status}`);
  } else if (home !== undefined) {
    const href = HREF.exec(CANONICAL_LINK.exec(await home.text())?.[0] ?? '')?.[1];
    if (href === undefined || parseUrl(href, canonicalOrigin)?.origin !== canonicalOrigin) {
      failures.push(`${canonicalOrigin}/: canonical 이 정본 호스트가 아니다 (${href ?? '없음'})`);
    }
  }

  // 경로는 `new URL(path, base)` 로 합치지 않는다. `//evil.example` 이 호스트로 해석되기 때문이다.
  for (const alias of options.aliases) {
    for (const probe of options.probes) {
      const url = `https://${alias}${probe}`;
      const expected = `${canonicalOrigin}${probe}`;
      const response = await get(url);
      if (response === undefined) continue;
      const location = response.headers.get('location');
      const target = location === null ? undefined : parseUrl(location, url);
      if (response.status !== 301 || target?.href !== expected) {
        failures.push(
          `${url}: ${expected} 로 가는 301 이 아니다 (${response.status} ${location ?? ''})`.trimEnd(),
        );
      }
    }
    for (const probe of options.hostileProbes) {
      const url = `https://${alias}${probe}`;
      const response = await get(url);
      if (response === undefined) continue;
      const location = response.headers.get('location');
      const target = location === null ? undefined : parseUrl(location, url);
      if (response.status !== 301 || target?.origin !== canonicalOrigin) {
        failures.push(
          `${url}: 정본 origin 에 머무는 301 이 아니다 (${response.status} ${location ?? ''})`.trimEnd(),
        );
      }
    }
  }

  for (const legacy of options.legacyPaths) {
    const url = new URL(legacy, canonicalOrigin).href;
    const response = await get(url);
    if (response !== undefined && response.status !== 200)
      failures.push(`${url}: 200 이 아니라 ${response.status}`);
  }

  for (const { url, integrity } of options.services) {
    const response = await get(url);
    if (response === undefined) continue;
    if (response.status !== 200) {
      failures.push(`${url}: 200 이 아니라 ${response.status}`);
      continue;
    }
    if (integrity === undefined) continue;
    const body = Buffer.from(await response.arrayBuffer());
    const actual = `sha384-${createHash('sha384').update(body).digest('base64')}`;
    if (actual !== integrity) failures.push(`${url}: integrity 가 다르다 (${actual})`);
  }

  return failures;
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  const code =
    typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : '';
  return code === '' ? error.message : `${error.message}: ${code}`;
}

/** 옛 사이트 sitemap 에 있던 경로 목록(`legacy-paths.txt`). */
export async function readLegacyPaths(): Promise<string[]> {
  const text = await readFile(new URL('./legacy-paths.txt', import.meta.url), 'utf8');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}
