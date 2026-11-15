import { describe, expect, it } from 'vitest';

describe('사이트 콘텐츠 계약', () => {
  it('NOR-208 AC-1: 프로필·경력·포트폴리오 스키마와 자리를 내보낸다', async () => {
    const contract = await import('./index.ts');
    expect(contract).toHaveProperty('SITE_COLLECTIONS');
    const site = (contract as unknown as Record<string, unknown>)['SITE_COLLECTIONS'] as Record<
      string,
      { schema: unknown; path: string }
    >;
    expect(Object.keys(site).sort()).toEqual(['experience', 'portfolio', 'profile', 'series']);
    expect(site['profile']?.path).toBe('apps/blog/src/content/profile.json');
    expect(site['series']?.path).toBe('apps/blog/src/content/series');
    expect(site['series']?.schema).toBe(contract.seriesSchema);
  });

  it('NOR-208 AC-1: 경력은 끝난 날짜가 없으면 null 로 읽는다', async () => {
    const contract = (await import('./index.ts')) as unknown as Record<
      string,
      { parse: (value: unknown) => { endDate: unknown } }
    >;
    const experience = contract['experienceSchema'];
    expect(experience).toBeDefined();
    const parsed = experience?.parse({
      organization: '회사',
      role: '개발',
      period: '2020 – 현재',
      highlights: ['일'],
      visible: true,
    });
    expect(parsed?.endDate).toBeNull();
  });
});
