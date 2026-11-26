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

describe('NOR-254 번역판 댓글 묶음', () => {
  it('NOR-253 AC-2, NOR-254 AC-1: 영어 글은 translationKey 로 처음부터 한국어판 묶음을 쓰고, 한국어 글은 자기 경로다', async () => {
    const mod = await import('./comments.ts');
    expect(
      mod.commentThreadPath({ slug: 'devlog-1', lang: 'ko', translationKey: 'devlog-1' }),
    ).toBe('/blog/devlog-1');
    // 한국어판이 아직 공개되지 않았어도 같다.
    expect(
      mod.commentThreadPath({ slug: 'devlog-one', lang: 'en', translationKey: 'devlog-1' }),
    ).toBe('/blog/devlog-1');
    expect(mod.commentThreadPath({ slug: 'solo', lang: 'en' })).toBe('/en/blog/solo');
    expect(mod.commentThreadPath({ slug: 'plain', lang: 'ko' })).toBe('/blog/plain');
    expect(mod.commentsEmbed('devlog-one', 'en', '/blog/devlog-1')).toMatchObject({
      pageId: '/blog/devlog-1',
      lang: 'en',
    });
  });
});
