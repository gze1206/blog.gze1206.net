import { describe, expect, it } from 'vitest';
import { lazyOnce } from './lazy-once';

describe('lazyOnce (NOR-231 AC-1)', () => {
  it('처음 부를 때만 불러오고 동시 호출에는 같은 약속을 준다', async () => {
    let calls = 0;
    const get = lazyOnce(async () => {
      calls += 1;
      return 'palette';
    });
    const [first, second] = [get(), get()];
    expect(first).toBe(second);
    await expect(first).resolves.toBe('palette');
    await get();
    expect(calls).toBe(1);
  });

  it('실패하면 다음 호출에서 다시 불러온다', async () => {
    let calls = 0;
    const get = lazyOnce(async () => {
      calls += 1;
      if (calls === 1) throw new Error('network');
      return 'palette';
    });
    await expect(get()).rejects.toThrow('network');
    await expect(get()).resolves.toBe('palette');
    expect(calls).toBe(2);
  });
});
