/**
 * 빌드타임 생성 이미지용 **내용 주소(content-addressed) 온디스크 캐시** (NOR-28).
 *
 * 성격은 ADR 0008 의 `disk-cache.ts` 와 같다 — 최적화일 뿐이라 **절대 던지지 않고**,
 * 읽기/쓰기 실패는 전부 "미스"로 취급하며, 임시 파일 + `rename` 으로 원자적으로 쓴다.
 *
 * 다른 점 두 가지:
 * 1. **값이 바이너리다.** PNG 를 JSON 에 넣으려면 base64(+33%)로 부풀려야 하고 파싱 비용도
 *    붙는다. 그래서 JSON 래핑 없이 파일 그대로 쓴다.
 * 2. **TTL 이 없다.** 키가 곧 입력의 해시라서 입력이 바뀌면 다른 파일이 된다. 시간이 지나
 *    값이 낡는 일이 없으므로 만료 개념이 필요 없다(옛 항목은 그냥 고아로 남고,
 *    `node_modules/.cache` 를 지우면 사라진다).
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_DIR = 'node_modules/.cache/og-images';

export interface BinaryCacheOptions {
  /** 캐시 항목 그룹(파일명 접두사). 예: `card` */
  readonly namespace: string;
  /** 그룹 내 고유 키. **입력 전체**를 담아야 캐시가 낡지 않는다. */
  readonly key: string;
  /** 캐시 디렉토리 override. 기본값은 `OG_CACHE_DIR` 환경변수 → `node_modules/.cache/og-images` */
  readonly dir?: string | undefined;
}

let tmpCounter = 0;

function resolveDir(options: BinaryCacheOptions): string {
  return options.dir ?? process.env.OG_CACHE_DIR ?? DEFAULT_DIR;
}

/** 캐시 항목의 파일 경로. 테스트와 디버깅에서 쓴다. */
export function cacheEntryPath(options: BinaryCacheOptions): string {
  const hash = createHash('sha256').update(options.key).digest('hex').slice(0, 32);
  return join(resolveDir(options), `${options.namespace}-${hash}.bin`);
}

/**
 * 캐시에 있으면 그 바이트를, 없으면 `producer()` 결과를 반환하고 캐시에 기록한다.
 *
 * `producer` 가 던지면 **그대로 전파한다** — 실패를 캐시하지 않는다. 이미지 생성 실패는
 * 호출부가 폴백으로 처리해야 하는 사건이지, 다음 빌드까지 굳혀둘 값이 아니다.
 */
export async function withBinaryCache(
  options: BinaryCacheOptions,
  producer: () => Promise<Buffer>,
): Promise<Buffer> {
  const target = cacheEntryPath(options);
  try {
    return await readFile(target);
  } catch {
    // 미스·손상·권한 문제 모두 "캐시 없음"으로 동일하게 취급한다.
  }

  const value = await producer();

  const tmp = `${target}.${process.pid}-${tmpCounter++}.tmp`;
  try {
    await mkdir(resolveDir(options), { recursive: true });
    await writeFile(tmp, value);
    await rename(tmp, target);
  } catch {
    await rm(tmp, { force: true }).catch(() => {});
  }
  return value;
}
