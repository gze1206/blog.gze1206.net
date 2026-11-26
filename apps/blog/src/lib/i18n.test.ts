import { describe, expect, it } from 'vitest';
import { findTranslation, formatDate, langFromPath, localizePath, readingLabel, UI } from './i18n';
import { blogPagePath, postPath } from './routes';

describe('NOR-250 언어 도우미', () => {
  it('NOR-250 AC-3: 경로에서 언어를 읽고 언어별 경로를 만든다', () => {
    expect(langFromPath('/')).toBe('ko');
    expect(langFromPath('/blog/hello')).toBe('ko');
    expect(langFromPath('/en')).toBe('en');
    expect(langFromPath('/en/')).toBe('en');
    expect(langFromPath('/en/blog/hello')).toBe('en');
    expect(langFromPath('/english')).toBe('ko');
    expect(localizePath('en', '/')).toBe('/en');
    expect(localizePath('en', '/blog')).toBe('/en/blog');
    expect(localizePath('ko', '/blog')).toBe('/blog');
    expect(postPath('hello', 'en')).toBe('/en/blog/hello');
    expect(postPath('hello')).toBe('/blog/hello');
    expect(blogPagePath(1, 'en')).toBe('/en/blog');
    expect(blogPagePath(3, 'en')).toBe('/en/blog/3');
  });

  it('NOR-250 AC-3: 날짜·읽는 시간·화면 문구를 언어별로 만든다', () => {
    const date = new Date('2026-07-20T00:00:00Z');
    expect(formatDate(date, 'ko')).toBe('2026년 7월 20일');
    expect(formatDate(date, 'en')).toBe('July 20, 2026');
    expect(readingLabel({ seconds: 30, minutes: 1 }, 'en')).toBe('Under 1 min');
    expect(readingLabel({ seconds: 300, minutes: 5 }, 'en')).toBe('5 min read');
    expect(readingLabel({ seconds: 300, minutes: 5 }, 'ko')).toBe('약 5분');
    expect(Object.keys(UI.en).sort()).toEqual(Object.keys(UI.ko).sort());
    expect(UI.en.htmlLang).toBe('en');
    expect(UI.ko.htmlLang).toBe('ko');
  });
});

describe('NOR-250 번역판', () => {
  const make = (lang: 'ko' | 'en', slug: string, translationKey?: string) => ({
    data: { lang, slug, ...(translationKey === undefined ? {} : { translationKey }) },
  });
  it('NOR-250 AC-4: 같은 translationKey 를 가진 다른 언어 글을 찾는다', () => {
    const ko = make('ko', 'devlog-1', 'devlog-1');
    const en = make('en', 'devlog-1', 'devlog-1');
    const other = make('en', 'other', 'other');
    const lonely = make('ko', 'alone');
    expect(findTranslation(ko, [ko, en, other])).toBe(en);
    expect(findTranslation(en, [ko, en, other])).toBe(ko);
    expect(findTranslation(lonely, [ko, en, other, lonely])).toBeUndefined();
    expect(findTranslation(make('ko', 'x', 'k'), [make('ko', 'y', 'k')])).toBeUndefined();
  });
});
