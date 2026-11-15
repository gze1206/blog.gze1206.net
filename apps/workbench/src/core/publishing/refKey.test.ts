import { describe, expect, it } from 'vitest';

describe('publishRefKey', () => {
  it('NOR-214 AC-1: ASCII 소문자·숫자·하이픈만 돌려주고 같은 id 는 같은 값이다', async () => {
    const mod = await import('./refKey.js');
    expect(mod).toHaveProperty('publishRefKey');
    expect(mod.publishRefKey('safe-publish')).toBe('safe-publish');
    const korean: string = mod.publishRefKey('니체의-초월자');
    expect(korean).toMatch(/^[a-z0-9][a-z0-9-]*$/u);
    expect(korean).toBe(mod.publishRefKey('니체의-초월자'));
    expect(korean).not.toBe(mod.publishRefKey('니체의-초인'));
    expect(mod.publishRefKey('C# 입문 2판')).toMatch(/^c-2-[0-9a-f]{10}$/u);
  });
});
