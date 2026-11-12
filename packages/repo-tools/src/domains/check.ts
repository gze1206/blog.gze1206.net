import { readFile } from 'node:fs/promises';

/** 런칭 직후와 이후 회귀에서 같은 기준으로 공개 도메인을 확인한다 (NOR-199). */
export interface DomainCheckOptions {
  /** 정본 origin. 예: `https://gze1206.net` */
  canonical: string;
  /** 정본으로 301 해야 하는 이전 호스트 이름 */
  aliases: readonly string[];
  /** 이전 호스트에서 경로·쿼리 보존을 확인할 경로. 예: `/blog/x/?ref=check` */
  probe: string;
  /** 정본 호스트에서 200 이어야 하는 옛 사이트 경로 */
  legacyPaths: readonly string[];
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const CANONICAL_LINK = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i;
const HREF = /\bhref=["']([^"']+)["']/i;

/** 실패 항목을 모두 돌려준다. 빈 배열이면 통과다. 리다이렉트는 따라가지 않는다. */
export async function checkDomains(
  fetchFn: FetchLike,
  options: DomainCheckOptions,
): Promise<string[]> {
  const failures: string[] = [];
  const get = (url: string) => fetchFn(url, { redirect: 'manual' });
  const canonicalOrigin = new URL(options.canonical).origin;

  const home = await get(`${canonicalOrigin}/`);
  if (home.status !== 200) {
    failures.push(`${canonicalOrigin}/: 200 이 아니라 ${home.status}`);
  } else {
    const href = HREF.exec(CANONICAL_LINK.exec(await home.text())?.[0] ?? '')?.[1];
    if (href === undefined || new URL(href, canonicalOrigin).origin !== canonicalOrigin) {
      failures.push(`${canonicalOrigin}/: canonical 이 정본 호스트가 아니다 (${href ?? '없음'})`);
    }
  }

  const expected = new URL(options.probe, canonicalOrigin).href;
  for (const alias of options.aliases) {
    const url = new URL(options.probe, `https://${alias}`).href;
    const response = await get(url);
    const location = response.headers.get('location');
    if (response.status !== 301 || location === null || new URL(location, url).href !== expected) {
      failures.push(
        `${url}: ${expected} 로 가는 301 이 아니다 (${response.status} ${location ?? ''})`.trimEnd(),
      );
    }
  }

  for (const legacy of options.legacyPaths) {
    const url = new URL(legacy, canonicalOrigin).href;
    const response = await get(url);
    if (response.status !== 200) failures.push(`${url}: 200 이 아니라 ${response.status}`);
  }

  return failures;
}

/** 옛 사이트 sitemap 에 있던 경로 목록(`legacy-paths.txt`). */
export async function readLegacyPaths(): Promise<string[]> {
  const text = await readFile(new URL('./legacy-paths.txt', import.meta.url), 'utf8');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}
