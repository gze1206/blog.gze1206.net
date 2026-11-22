import { describe, expect, it } from 'vitest';

describe('analytics', () => {
  it('NOR-234 AC-2: 운영 도메인에서만 GA 를 싣는다', async () => {
    const mod = await import('./analytics.ts');
    expect(mod).toHaveProperty('shouldLoadAnalytics');
    expect(mod.shouldLoadAnalytics('gze1206.net')).toBe(true);
    for (const host of [
      'www.gze1206.net',
      '127.0.0.1',
      'localhost',
      'abc.blog-gze1206-net.pages.dev',
    ]) {
      expect(mod.shouldLoadAnalytics(host), host).toBe(false);
    }
  });

  it('NOR-234 AC-3: Google Signals 와 광고 개인화를 끈다', async () => {
    const mod = await import('./analytics.ts');
    expect(mod.GA_MEASUREMENT_ID).toBe('G-VPVRFS2P5S');
    expect(mod.GA_CONFIG).toMatchObject({
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  });

  it('NOR-234 AC-4: 본문 끝에 닿고 충분히 머물러야 끝까지 읽음이다', async () => {
    const mod = await import('./analytics.ts');
    expect(mod).toHaveProperty('isReadComplete');
    // 짧은 글도 15초는 머물러야 한다.
    expect(mod.isReadComplete({ reachedEnd: true, visibleMs: 14_999, minutes: 1 })).toBe(false);
    expect(mod.isReadComplete({ reachedEnd: true, visibleMs: 30_000, minutes: 1 })).toBe(true);
    // 10분짜리 글은 5분이 기준이다.
    expect(mod.isReadComplete({ reachedEnd: true, visibleMs: 299_999, minutes: 10 })).toBe(false);
    expect(mod.isReadComplete({ reachedEnd: true, visibleMs: 300_000, minutes: 10 })).toBe(true);
    // 오래 열어 두기만 하고 끝까지 내리지 않으면 읽은 것이 아니다.
    expect(mod.isReadComplete({ reachedEnd: false, visibleMs: 3_600_000, minutes: 3 })).toBe(false);
  });
});
