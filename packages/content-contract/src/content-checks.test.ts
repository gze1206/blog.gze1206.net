import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BLOG_LAYOUT, SITE_COLLECTIONS, bookSchema, portfolioSchema } from './index.ts';

function failedPaths(schema: { safeParse: (value: unknown) => unknown }, value: unknown): string[] {
  const result = schema.safeParse(value) as
    { success: true } | { success: false; error: { issues: { path: PropertyKey[] }[] } };
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('콘텐츠 전반 양식', () => {
  it('NOR-237 AC-1: 포트폴리오 기간은 있으면 경력과 같은 형식이다', () => {
    const base = { title: 't', summary: 's', stack: ['C#'] };
    expect(failedPaths(portfolioSchema, base)).toEqual([]);
    expect(failedPaths(portfolioSchema, { ...base, period: '2026.04 – 2026.12' })).toEqual([]);
    expect(failedPaths(portfolioSchema, { ...base, period: '2026.04 – 현재' })).toEqual([]);
    for (const period of ['2026.04 ~ 2026.12', '2026.4 – 2026.12', '2026.12 – 2026.04'])
      expect(failedPaths(portfolioSchema, { ...base, period }), period).toEqual(['period']);
  });

  it('NOR-237 AC-3: 책의 finishedAt 은 startedAt 보다 이르지 않고 relatedPost 는 slug 다', () => {
    const base = {
      title: '책',
      authors: ['저자'],
      status: 'finished',
      format: 'paper',
      source: 'purchase',
      startedAt: '2026-08-06',
      finishedAt: '2026-08-06',
    };
    expect(failedPaths(bookSchema, base)).toEqual([]);
    expect(failedPaths(bookSchema, { ...base, finishedAt: '2026-08-05' })).toEqual(['finishedAt']);
    expect(failedPaths(bookSchema, { ...base, relatedPost: 'a-post' })).toEqual([]);
    expect(failedPaths(bookSchema, { ...base, relatedPost: '/blog/a-post' })).toEqual([
      'relatedPost',
    ]);
  });
});

it('NOR-237 AC-7: 저장소의 포트폴리오·글·책이 새 규칙을 통과한다', () => {
  const root = new URL('../../../', import.meta.url);
  const read = (dir: string, pattern: RegExp) => {
    const path = fileURLToPath(new URL(`${dir}/`, root));
    return readdirSync(path)
      .filter((name) => pattern.test(name))
      .map((name) => ({ name, text: readFileSync(`${path}${name}`, 'utf8') }));
  };
  const failures: string[] = [];
  for (const { name, text } of read(SITE_COLLECTIONS.portfolio.path, /\.json$/u)) {
    const result = portfolioSchema.safeParse(JSON.parse(text));
    if (!result.success) failures.push(`${name}: ${result.error.message}`);
  }
  for (const { name, text } of read(BLOG_LAYOUT.booksDir, /\.json$/u)) {
    const result = bookSchema.safeParse(JSON.parse(text));
    if (!result.success) failures.push(`${name}: ${result.error.message}`);
  }
  expect(failures).toEqual([]);
});

it('NOR-250 AC-1: 시리즈는 선택 필드 en 에 영어 이름과 설명을 받는다', async () => {
  const { seriesSchema } = await import('./index.ts');
  const base = { name: '개발기', slug: 'devlog', description: '설명' };
  expect(seriesSchema.parse(base)).not.toHaveProperty('en');
  expect(seriesSchema.parse({ ...base, en: { name: 'Devlog', description: 'Notes' } }).en).toEqual({
    name: 'Devlog',
    description: 'Notes',
  });
  expect(seriesSchema.safeParse({ ...base, en: { name: '' } }).success).toBe(false);
});
