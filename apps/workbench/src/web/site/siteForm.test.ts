import { describe, expect, it } from 'vitest';

async function form() {
  const mod = await import('./siteForm.js');
  expect(mod).toHaveProperty('SITE_FIELDS');
  return mod;
}

describe('사이트 콘텐츠 폼', () => {
  it('NOR-208 AC-7: 컬렉션마다 칸을 정의한다', async () => {
    const { SITE_FIELDS } = await form();
    expect(SITE_FIELDS.profile.map((field) => field.key)).toEqual(
      expect.arrayContaining(['name', 'headline', 'introduction', 'skills', 'about', 'links']),
    );
    expect(SITE_FIELDS.experience.find((field) => field.key === 'visible')?.type).toBe('boolean');
    expect(SITE_FIELDS.portfolio.find((field) => field.key === 'media')?.type).toBe('rows');
    expect(SITE_FIELDS.series.map((field) => field.key)).toEqual(['name', 'slug', 'description']);
  });

  it('NOR-208 AC-7: 목록은 한 줄에 하나, 문단은 빈 줄로 나눈다', async () => {
    const { SITE_FIELDS, toFormValue, applyFormValue } = await form();
    const skills = SITE_FIELDS.profile.find((field) => field.key === 'skills');
    const about = SITE_FIELDS.profile.find((field) => field.key === 'about');
    if (!skills || !about) throw new Error('missing field');
    expect(toFormValue(skills, { skills: ['C#', 'Unity'] })).toBe('C#\nUnity');
    expect(applyFormValue({ skills: [] }, skills, ' C# \n\nUnity\n')).toEqual({
      skills: ['C#', 'Unity'],
    });
    expect(toFormValue(about, { about: ['첫 문단', '둘째 문단'] })).toBe('첫 문단\n\n둘째 문단');
    expect(applyFormValue({}, about, '첫 문단\n이어서\n\n\n둘째 문단')).toEqual({
      about: ['첫 문단\n이어서', '둘째 문단'],
    });
  });

  it('NOR-208 AC-7: 비운 선택 칸은 키를 지우고, 화면에 없는 필드는 남긴다', async () => {
    const { SITE_FIELDS, applyFormValue } = await form();
    const tagline = SITE_FIELDS.profile.find((field) => field.key === 'tagline');
    if (!tagline) throw new Error('missing field');
    expect(applyFormValue({ name: 'n', tagline: 't', extra: 1 }, tagline, '  ')).toEqual({
      name: 'n',
      extra: 1,
    });
  });

  it('NOR-208 AC-7: 행 목록은 빈 선택 칸을 빼고 숫자 칸은 숫자로 쓴다', async () => {
    const { SITE_FIELDS, toFormValue, applyFormValue } = await form();
    const media = SITE_FIELDS.portfolio.find((field) => field.key === 'media');
    if (!media) throw new Error('missing field');
    const rows = [{ src: '/a.webp', alt: '그림', width: '960', height: '600', caption: '' }];
    expect(applyFormValue({}, media, rows)).toEqual({
      media: [{ src: '/a.webp', alt: '그림', width: 960, height: 600 }],
    });
    expect(
      toFormValue(media, { media: [{ src: '/a.webp', alt: '그림', width: 960, height: 600 }] }),
    ).toMatchObject([{ src: '/a.webp', alt: '그림', width: '960', height: '600', caption: '' }]);
  });

  it('NOR-208 AC-6: 새 항목은 컬렉션의 빈 틀에서 시작한다', async () => {
    const { newSiteData } = await form();
    expect(newSiteData('series')).toEqual({ name: '', slug: '', description: '' });
    expect(newSiteData('experience')).toMatchObject({ highlights: [], visible: true });
  });
});

it('NOR-208 AC-9: 행 목록을 고쳐도 행에 있던 화면 밖 필드는 남는다', async () => {
  const { SITE_FIELDS, toFormValue, applyFormValue } = await form();
  const links = SITE_FIELDS.profile.find((field) => field.key === 'links');
  if (!links) throw new Error('missing field');
  const data = { links: [{ label: 'GitHub', url: 'https://github.com/x', icon: 'gh' }] };
  const rows = toFormValue(links, data) as Record<string, string>[];
  const edited = rows.map((row) => ({ ...row, label: '깃허브' }));
  expect(applyFormValue(data, links, edited)).toEqual({
    links: [{ label: '깃허브', url: 'https://github.com/x', icon: 'gh' }],
  });
});

it('NOR-236 AC-3: 경력 기간은 모양만 다른 입력을 표준 형식으로 고친다', async () => {
  const { SITE_FIELDS } = await form();
  const field = SITE_FIELDS.experience.find((entry) => entry.key === 'period');
  // 고치기는 칸을 떠날 때 한다. 입력하는 도중(2025.1 → 2025.10)에 고치면 글자가 바뀐다.
  const normalize = field !== undefined && 'normalize' in field ? field.normalize : undefined;
  expect(normalize).toBeTypeOf('function');
  if (normalize === undefined) return;
  expect(normalize('2025.05 - 2025.09')).toBe('2025.05 – 2025.09');
  expect(normalize('2025.5-2025.9')).toBe('2025.05 – 2025.09');
  expect(normalize(' 2025.05 ~ 현재 ')).toBe('2025.05 – 현재');
  expect(normalize('2025.05—2025.09')).toBe('2025.05 – 2025.09');
  expect(normalize('2025.05 – 2025.09')).toBe('2025.05 – 2025.09');
  // 고칠 수 없는 입력은 그대로 둔다. 계약 검사가 오류를 보여 준다.
  expect(normalize('2025.05 -')).toBe('2025.05 -');
  expect(normalize('언젠가')).toBe('언젠가');
});
