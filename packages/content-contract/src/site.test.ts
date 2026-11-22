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
      period: '2020.01 – 현재',
      highlights: ['일'],
      visible: true,
    });
    expect(parsed?.endDate).toBeNull();
  });
});

describe('사이트 콘텐츠 주소 검사', () => {
  const profile = (url: string) => ({
    name: 'n',
    headline: 'h',
    introduction: 'i',
    skills: ['s'],
    links: [{ label: 'l', url }],
  });
  const portfolio = (extra: Record<string, unknown>) => ({
    title: 't',
    summary: 's',
    stack: ['a'],
    ...extra,
  });

  it('NOR-208 AC-8: 프로필 링크는 http(s)·mailto 만 받는다', async () => {
    const { profileSchema } = await import('./index.ts');
    for (const url of ['https://github.com/x', 'http://a.test/', 'mailto:a@b.test'])
      expect(profileSchema.safeParse(profile(url)).success, url).toBe(true);
    for (const url of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,x',
      'java\tscript:alert(1)',
      ' javascript:alert(1)',
    ])
      expect(profileSchema.safeParse(profile(url)).success, url).toBe(false);
  });

  it('NOR-208 AC-8: 포트폴리오 링크는 http(s) 만, 이미지는 사이트 안 경로만 받는다', async () => {
    const { portfolioSchema } = await import('./index.ts');
    const ok = (extra: Record<string, unknown>) =>
      portfolioSchema.safeParse(portfolio(extra)).success;
    expect(ok({ links: [{ repo: 'https://github.com/x' }] })).toBe(true);
    expect(ok({ links: [{ repo: 'mailto:a@b.test' }] })).toBe(false);
    expect(ok({ links: [{ demo: 'javascript:alert(1)' }] })).toBe(false);
    const media = (src: string) => ({ media: [{ src, alt: 'a', width: 1, height: 1 }] });
    expect(ok(media('/img/portfolio/a.webp'))).toBe(true);
    for (const src of [
      'https://evil.test/a.png',
      '//evil.test/a.png',
      '/img/../x.png',
      'img/a.png',
    ])
      expect(ok(media(src)), src).toBe(false);
    expect(ok({ thumbnail: '/img/a.webp' })).toBe(true);
    expect(ok({ thumbnail: 'javascript:alert(1)' })).toBe(false);
  });
});
