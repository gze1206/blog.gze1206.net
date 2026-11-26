import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { localizeExperience, localizePortfolio, localizeProfile } from './site-i18n';

describe('NOR-251 사이트 콘텐츠 지역화', () => {
  it('NOR-251 AC-2: 프로필은 영어 값을 쓰고 비면 한국어 값, 링크 라벨을 바꾼다', () => {
    const profile = {
      name: '김개발',
      headline: '개발자',
      introduction: '소개',
      about: ['문단'],
      skills: ['C#'],
      links: [
        { label: '이메일', url: 'mailto:a@example.com' },
        { label: 'GitHub', url: 'https://github.com/a' },
      ],
      en: {
        headline: 'Developer',
        introduction: 'Intro',
        about: ['Paragraph'],
        linkLabels: { 이메일: 'Email' },
      },
    };
    expect(localizeProfile(profile, 'ko')).toMatchObject({ headline: '개발자', about: ['문단'] });
    expect(localizeProfile(profile, 'en')).toMatchObject({
      name: '김개발',
      headline: 'Developer',
      introduction: 'Intro',
      about: ['Paragraph'],
      links: [{ label: 'Email' }, { label: 'GitHub' }],
    });
    expect(localizeProfile({ ...profile, en: undefined }, 'en').headline).toBe('개발자');
  });

  it('NOR-251 AC-2: 경력의 "현재" 는 Present 로, 포트폴리오 이미지 설명은 순서대로 바꾼다', () => {
    const job = {
      organization: '회사',
      role: '개발',
      period: '2025.05 – 현재',
      highlights: ['일'],
      en: { organization: 'Company', role: 'Developer', highlights: ['Work'] },
    };
    expect(localizeExperience(job, 'en')).toEqual({
      organization: 'Company',
      role: 'Developer',
      period: '2025.05 – Present',
      highlights: ['Work'],
    });
    expect(localizeExperience(job, 'ko').period).toBe('2025.05 – 현재');
    const work = {
      title: '작업',
      summary: '요약',
      stack: ['C#', '게임 서버'],
      highlights: ['한 일'],
      media: [
        { src: '/a.webp', alt: '키 비주얼', width: 1, height: 1 },
        { src: '/b.webp', alt: '둘째', width: 1, height: 1 },
      ],
      en: {
        summary: 'Summary',
        stack: ['C#', 'Game server'],
        highlights: ['Work'],
        media: [{ alt: 'Key visual' }],
      },
    };
    expect(localizePortfolio(work, 'en')).toMatchObject({
      title: '작업',
      summary: 'Summary',
      stack: ['C#', 'Game server'],
      highlights: ['Work'],
      media: [{ alt: 'Key visual' }, { alt: '둘째' }],
    });
  });
});

it('NOR-251 AC-3: 저장소의 사이트 콘텐츠는 영어 값을 갖는다', () => {
  const content = fileURLToPath(new URL('../content/', import.meta.url));
  const json = (path: string) =>
    JSON.parse(readFileSync(`${content}${path}`, 'utf8')) as Record<string, unknown>;
  const missing: string[] = [];
  if (json('profile.json')['en'] === undefined) missing.push('profile.json');
  for (const dir of ['experience', 'portfolio', 'series']) {
    for (const name of readdirSync(`${content}${dir}`).filter((file) => file.endsWith('.json'))) {
      const data = json(`${dir}/${name}`);
      if (dir === 'experience' && data['visible'] === false) continue;
      if (dir === 'series' && name.includes('fixture')) continue;
      if (data['en'] === undefined) missing.push(`${dir}/${name}`);
    }
  }
  expect(missing).toEqual([]);
});
