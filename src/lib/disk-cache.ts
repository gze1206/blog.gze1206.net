import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * 빌드타임 외부 fetch 결과를 위한 TTL 온디스크 캐시.
 *
 * 커스텀 블럭(`{% bookmark %}` / `{% github %}`)은 빌드타임에 외부를 때린다. 캐시가 없으면
 * 로컬 반복 빌드가 느려지고 GitHub 미인증 API(60 req/h)에 쉽게 걸린다.
 * 전략·TTL·위치의 근거는 ADR 0008 참고.
 *
 * 이 모듈은 **절대 던지지 않는다**(producer 가 던지는 경우 제외). 캐시는 최적화일 뿐,
 * 읽기/쓰기 실패는 그냥 미스로 취급한다.
 */

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

const DEFAULT_DIR = 'node_modules/.cache/blocks';

export interface CacheOptions {
  /** 캐시 항목 그룹(파일명 접두사). 예: `og`, `gh` */
  namespace: string;
  /** 그룹 내 고유 키. 해시로 파일명에 반영된다 */
  key: string;
  /** 값이 있을 때의 유효 기간(ms) */
  ttlMs: number;
  /** 값이 `null`(=취득 실패)일 때의 유효 기간(ms). 기본값은 `ttlMs` */
  failTtlMs?: number;
  /** 캐시 디렉토리 override. 기본값은 `BLOCK_CACHE_DIR` 환경변수 → `node_modules/.cache/blocks` */
  dir?: string;
}

interface CacheEntry<T> {
  at: number;
  value: T | null;
}

let tmpCounter = 0;

function resolveDir(options: CacheOptions): string {
  return options.dir ?? process.env.BLOCK_CACHE_DIR ?? DEFAULT_DIR;
}

function entryPath(options: CacheOptions): string {
  const hash = createHash('sha256').update(options.key).digest('hex').slice(0, 32);
  return join(resolveDir(options), `${options.namespace}-${hash}.json`);
}

function isFresh<T>(entry: CacheEntry<T>, options: CacheOptions): boolean {
  const ttl = entry.value === null ? (options.failTtlMs ?? options.ttlMs) : options.ttlMs;
  const age = Date.now() - entry.at;
  return age >= 0 && age < ttl;
}

async function readEntry<T>(options: CacheOptions): Promise<CacheEntry<T> | null> {
  try {
    const raw = await readFile(entryPath(options), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (!('at' in parsed) || typeof parsed.at !== 'number' || !('value' in parsed)) return null;
    const entry = parsed as CacheEntry<T>;
    return isFresh(entry, options) ? entry : null;
  } catch {
    // 미스·손상·권한 문제 모두 "캐시 없음"으로 동일하게 취급한다.
    return null;
  }
}

async function writeEntry<T>(options: CacheOptions, value: T | null): Promise<void> {
  const target = entryPath(options);
  // 같은 캐시 파일을 여러 프로세스가 동시에 쓰더라도 반쪽짜리 JSON 이 남지 않도록
  // 임시 파일에 쓰고 rename 으로 원자적으로 교체한다.
  const tmp = `${target}.${process.pid}-${tmpCounter++}.tmp`;
  try {
    await mkdir(resolveDir(options), { recursive: true });
    const entry: CacheEntry<T> = { at: Date.now(), value };
    await writeFile(tmp, JSON.stringify(entry), 'utf8');
    await rename(tmp, target);
  } catch {
    await rm(tmp, { force: true }).catch(() => {});
  }
}

/**
 * 캐시가 유효하면 캐시값을, 아니면 `producer()` 결과를 반환하고 캐시에 기록한다.
 *
 * `producer` 가 `null` 을 반환하면(=취득 실패) 그 실패도 `failTtlMs` 동안 캐시한다.
 * 죽은 링크가 매 빌드마다 타임아웃만큼 빌드를 지연시키는 것을 막는다.
 */
export async function withCache<T>(
  options: CacheOptions,
  producer: () => Promise<T | null>,
): Promise<T | null> {
  const cached = await readEntry<T>(options);
  if (cached) return cached.value;

  const value = await producer();
  await writeEntry(options, value);
  return value;
}
