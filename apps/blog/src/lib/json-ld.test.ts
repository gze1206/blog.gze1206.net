import { describe, expect, it } from 'vitest';
import { buildArticleJsonLd, buildPersonJsonLd } from './json-ld';

describe('JSON-LD', () => {
  it('글의 작성·수정일과 저자를 BlogPosting으로 만든다', () => {
    expect(
      buildArticleJsonLd({
        title: '글',
        description: '설명',
        url: 'https://gze1206.net/blog/a',
        published: '2026-01-01T00:00:00.000Z',
        modified: '2026-01-02T00:00:00.000Z',
      }),
    ).toMatchObject({
      '@type': 'BlogPosting',
      datePublished: '2026-01-01T00:00:00.000Z',
      author: { name: 'gze1206' },
    });
  });

  it('About용 Person은 공개 소개와 URL만 담는다', () => {
    expect(buildPersonJsonLd('https://gze1206.net/')).toMatchObject({
      '@type': 'Person',
      name: 'gze1206',
      url: 'https://gze1206.net/',
    });
  });
});

it('NOR-210 AC-9: JSON-LD 직렬화는 < 를 이스케이프해 script 를 닫을 수 없다', async () => {
  const mod = await import('./json-ld.ts');
  expect(mod).toHaveProperty('serializeJsonLd');
  const text = mod.serializeJsonLd({ headline: '</script><script>alert(1)</script>' });
  expect(text).not.toContain('<');
  expect(JSON.parse(text)).toEqual({ headline: '</script><script>alert(1)</script>' });
});
