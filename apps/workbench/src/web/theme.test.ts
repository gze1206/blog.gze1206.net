import { describe, expect, it } from 'vitest';

describe('theme', () => {
  it('NOR-203 AC-3: light·dark 는 그대로, system 은 시스템 설정을 따른다', async () => {
    const mod = await import('./theme.js');
    expect(mod).toHaveProperty('resolveTheme');
    expect(mod.resolveTheme('light', true)).toBe('light');
    expect(mod.resolveTheme('dark', false)).toBe('dark');
    expect(mod.resolveTheme('system', true)).toBe('dark');
    expect(mod.resolveTheme('system', false)).toBe('light');
  });

  it('NOR-203 AC-3: 저장값이 없거나 잘못되면 system 이다', async () => {
    const mod = await import('./theme.js');
    expect(mod).toHaveProperty('parsePreference');
    expect(mod.parsePreference(null)).toBe('system');
    expect(mod.parsePreference('purple')).toBe('system');
    expect(mod.parsePreference('dark')).toBe('dark');
  });
});
