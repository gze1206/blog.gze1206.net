import { describe, expect, it } from 'vitest';

describe('comments', () => {
  it('NOR-200 AC-1: 글 slug 로 Comentario 임베드 값을 만든다', async () => {
    const mod = await import('./comments.ts');
    expect(mod).toHaveProperty('commentsEmbed');
    expect(mod.commentsEmbed('hello')).toEqual({
      scriptSrc: 'https://comments.gze1206.net/comentario.js',
      integrity: 'sha384-LYPL1k9kCcfh4ZPBcswQmv3+cpWNdOKY2o+n/PV1uXIOgtS9ineQX7SBxONqjvhU',
      pageId: '/blog/hello',
      lang: 'ko',
    });
    expect(mod.commentsEmbed('한글 글').pageId).toBe('/blog/%ED%95%9C%EA%B8%80%20%EA%B8%80');
  });

  it('NOR-200 AC-2: 사이트 테마를 Comentario theme 값으로 바꾼다', async () => {
    const mod = await import('./comments.ts');
    expect(mod).toHaveProperty('commentsTheme');
    expect(mod.commentsTheme(true)).toBe('dark');
    expect(mod.commentsTheme(false)).toBe('light');
  });
});

describe('NOR-253 번역판 댓글 통합', () => {
  it('NOR-253 AC-2: 영어 글은 한국어판이 있으면 한국어판 경로를 댓글 묶음으로 쓴다', async () => {
    const mod = await import('./comments.ts');
    expect(mod).toHaveProperty('commentThreadPath');
    const ko = { slug: 'devlog-1', lang: 'ko' as const };
    const en = { slug: 'devlog-1-en', lang: 'en' as const };
    expect(mod.commentThreadPath(ko, en)).toBe('/blog/devlog-1');
    expect(mod.commentThreadPath(en, ko)).toBe('/blog/devlog-1');
    expect(mod.commentThreadPath(en, undefined)).toBe('/en/blog/devlog-1-en');
    expect(mod.commentThreadPath(ko, undefined)).toBe('/blog/devlog-1');
    expect(mod.commentsEmbed('devlog-1-en', 'en', '/blog/devlog-1')).toMatchObject({
      pageId: '/blog/devlog-1',
      lang: 'en',
    });
  });
});
