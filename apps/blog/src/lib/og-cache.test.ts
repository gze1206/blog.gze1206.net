import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheEntryPath, withBinaryCache } from './og-cache';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'og-cache-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('withBinaryCache', () => {
  it('첫 호출은 producer 를 부르고, 두 번째부터는 캐시에서 꺼낸다', async () => {
    const producer = vi.fn().mockResolvedValue(Buffer.from([1, 2, 3]));
    const options = { namespace: 'card', key: 'k', dir };

    const first = await withBinaryCache(options, producer);
    const second = await withBinaryCache(options, producer);

    expect(producer).toHaveBeenCalledTimes(1);
    expect(first.equals(Buffer.from([1, 2, 3]))).toBe(true);
    expect(second.equals(first)).toBe(true);
  });

  it('키가 다르면 다른 항목이다 (입력이 바뀌면 다시 그린다)', async () => {
    const a = await withBinaryCache({ namespace: 'card', key: 'a', dir }, async () =>
      Buffer.from('A'),
    );
    const b = await withBinaryCache({ namespace: 'card', key: 'b', dir }, async () =>
      Buffer.from('B'),
    );
    expect(a.toString()).toBe('A');
    expect(b.toString()).toBe('B');
  });

  it('바이너리를 그대로 쓴다 (JSON/base64 로 부풀리지 않는다)', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
    const options = { namespace: 'card', key: 'png', dir };
    await withBinaryCache(options, async () => bytes);
    expect((await readFile(cacheEntryPath(options))).equals(bytes)).toBe(true);
  });

  it('캐시 파일이 손상돼도 던지지 않는다', async () => {
    const options = { namespace: 'card', key: 'broken', dir };
    // 디렉토리를 파일로 막아 쓰기를 실패시킨다.
    await writeFile(join(dir, 'blocker'), 'x');
    const value = await withBinaryCache({ ...options, dir: join(dir, 'blocker') }, async () =>
      Buffer.from('ok'),
    );
    expect(value.toString()).toBe('ok');
  });

  it('producer 가 던지면 그대로 전파한다 (실패를 캐시하지 않는다)', async () => {
    const options = { namespace: 'card', key: 'fail', dir };
    await expect(
      withBinaryCache(options, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const value = await withBinaryCache(options, async () => Buffer.from('later'));
    expect(value.toString()).toBe('later');
  });
});
