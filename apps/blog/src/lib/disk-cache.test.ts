import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOUR_MS, withCache } from './disk-cache';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'blocks-cache-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('withCache', () => {
  it('첫 호출은 producer 를 실행하고 두 번째 호출은 캐시를 쓴다', async () => {
    const producer = vi.fn(async () => ({ title: '값' }));
    const opts = { namespace: 'og', key: 'https://example.com', ttlMs: HOUR_MS, dir };

    await expect(withCache(opts, producer)).resolves.toEqual({ title: '값' });
    await expect(withCache(opts, producer)).resolves.toEqual({ title: '값' });
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it('키가 다르면 서로 다른 항목으로 저장된다', async () => {
    const producer = vi.fn(async () => 'v');
    await withCache({ namespace: 'og', key: 'a', ttlMs: HOUR_MS, dir }, producer);
    await withCache({ namespace: 'og', key: 'b', ttlMs: HOUR_MS, dir }, producer);
    expect(producer).toHaveBeenCalledTimes(2);
    expect((await readdir(dir)).length).toBe(2);
  });

  it('네임스페이스가 다르면 서로 간섭하지 않는다', async () => {
    await withCache({ namespace: 'og', key: 'same', ttlMs: HOUR_MS, dir }, async () => 'og-value');
    await expect(
      withCache({ namespace: 'gh', key: 'same', ttlMs: HOUR_MS, dir }, async () => 'gh-value'),
    ).resolves.toBe('gh-value');
  });

  it('TTL 이 지나면 다시 producer 를 실행한다', async () => {
    const producer = vi.fn(async () => 'v');
    await withCache({ namespace: 'og', key: 'k', ttlMs: HOUR_MS, dir }, producer);

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * HOUR_MS);
    await withCache({ namespace: 'og', key: 'k', ttlMs: HOUR_MS, dir }, producer);
    expect(producer).toHaveBeenCalledTimes(2);
  });

  it('실패(null)도 캐시하되 failTtlMs 를 따로 적용한다', async () => {
    const producer = vi.fn(async () => null);
    const opts = { namespace: 'og', key: 'dead', ttlMs: 30 * HOUR_MS, failTtlMs: HOUR_MS, dir };

    await expect(withCache(opts, producer)).resolves.toBeNull();
    await withCache(opts, producer);
    expect(producer).toHaveBeenCalledTimes(1);

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * HOUR_MS);
    await withCache(opts, producer);
    expect(producer).toHaveBeenCalledTimes(2);
  });

  it('손상된 캐시 파일은 미스로 처리한다', async () => {
    const producer = vi.fn(async () => 'v');
    const opts = { namespace: 'og', key: 'k', ttlMs: HOUR_MS, dir };
    await withCache(opts, producer);

    const [file] = await readdir(dir);
    expect(file).toBeDefined();
    await writeFile(join(dir, file as string), '{ not json');

    await expect(withCache(opts, producer)).resolves.toBe('v');
    expect(producer).toHaveBeenCalledTimes(2);
  });

  it('캐시 디렉토리를 쓸 수 없어도 예외 없이 값을 반환한다', async () => {
    const unwritable = join(dir, 'file-not-a-dir');
    await writeFile(unwritable, 'x');
    await expect(
      withCache({ namespace: 'og', key: 'k', ttlMs: HOUR_MS, dir: unwritable }, async () => 'v'),
    ).resolves.toBe('v');
  });

  it('producer 가 던진 예외는 전파한다 (호출부가 폴백을 책임진다)', async () => {
    await expect(
      withCache({ namespace: 'og', key: 'k', ttlMs: HOUR_MS, dir }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
