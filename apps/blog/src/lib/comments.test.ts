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
