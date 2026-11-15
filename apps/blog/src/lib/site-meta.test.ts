import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  buildSeoMeta,
  formatTitle,
  isIndexablePath,
  normalizePath,
} from './site-meta';
import { blogPagePath, categoryPath, tagPath } from './routes';

const SITE = 'https://gze1206.net';

describe('formatTitle', () => {
  it('맨 제목 뒤에 사이트 이름을 붙인다', () => {
    expect(formatTitle('블로그')).toBe(`블로그 · ${SITE_NAME}`);
  });

  it('제목이 없으면 사이트 이름만 낸다', () => {
    expect(formatTitle()).toBe(SITE_NAME);
    expect(formatTitle('')).toBe(SITE_NAME);
    expect(formatTitle('   ')).toBe(SITE_NAME);
  });

  it('제목이 사이트 이름과 같으면 한 번만 낸다 (홈)', () => {
    expect(formatTitle(SITE_NAME)).toBe(SITE_NAME);
  });

  it('이미 접미사가 붙은 제목에 두 번 붙이지 않는다', () => {
    expect(formatTitle(`블로그 · ${SITE_NAME}`)).toBe(`블로그 · ${SITE_NAME}`);
  });

  it('앞뒤 공백을 다듬는다', () => {
    expect(formatTitle('  블로그  ')).toBe(`블로그 · ${SITE_NAME}`);
  });
});

describe('normalizePath', () => {
  it('끝 슬래시를 뗀다', () => {
    expect(normalizePath('/blog/')).toBe('/blog');
    expect(normalizePath('/blog/2/')).toBe('/blog/2');
  });

  it('루트는 슬래시를 유지한다', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
  });

  it('선행 슬래시를 채운다', () => {
    expect(normalizePath('blog')).toBe('/blog');
  });

  it('중복 슬래시를 접는다', () => {
    expect(normalizePath('//blog//2//')).toBe('/blog/2');
  });
});

describe('absoluteUrl', () => {
  it('site 기준 절대 URL 을 만든다', () => {
    expect(absoluteUrl('/blog', SITE)).toBe('https://gze1206.net/blog');
    expect(absoluteUrl('/blog/2', SITE)).toBe('https://gze1206.net/blog/2');
  });

  it('site 끝 슬래시 유무와 무관하게 슬래시가 겹치지 않는다', () => {
    expect(absoluteUrl('/blog', 'https://gze1206.net/')).toBe('https://gze1206.net/blog');
    expect(absoluteUrl('blog', 'https://gze1206.net')).toBe('https://gze1206.net/blog');
  });

  it('URL 객체도 받는다', () => {
    expect(absoluteUrl('/blog', new URL(SITE))).toBe('https://gze1206.net/blog');
  });

  it('루트는 슬래시 하나로 끝난다', () => {
    expect(absoluteUrl('/', SITE)).toBe('https://gze1206.net/');
  });

  it('경로 끝 슬래시를 떼고 정규화한다', () => {
    expect(absoluteUrl('/category/dev/', SITE)).toBe('https://gze1206.net/category/dev');
  });

  it('한글 경로는 routes.ts 와 같은 퍼센트 인코딩을 낸다', () => {
    expect(absoluteUrl(tagPath('웹-성능'), SITE)).toBe(
      `https://gze1206.net/tags/${encodeURIComponent('웹-성능')}`,
    );
    // 디코딩된 경로가 들어와도 같은 결과여야 한다 (Astro.url.pathname 이 어느 쪽이든 안전).
    expect(absoluteUrl('/tags/웹-성능', SITE)).toBe(absoluteUrl(tagPath('웹-성능'), SITE));
    expect(absoluteUrl(categoryPath('회고'), SITE)).toBe(
      `https://gze1206.net/category/${encodeURIComponent('회고')}`,
    );
  });

  it('site 가 없으면 던진다 (상대 URL 을 조용히 내보내지 않는다)', () => {
    expect(() => absoluteUrl('/blog', undefined)).toThrow(/site/);
  });
});

describe('isIndexablePath', () => {
  it('스모크 경로는 색인하지 않는다', () => {
    expect(isIndexablePath('/smoke')).toBe(false);
    expect(isIndexablePath('/smoke/')).toBe(false);
    expect(isIndexablePath('/smoke/cil')).toBe(false);
    expect(isIndexablePath('/smoke/math-mermaid/')).toBe(false);
  });

  it('일반 경로는 색인한다', () => {
    expect(isIndexablePath('/')).toBe(true);
    expect(isIndexablePath('/blog')).toBe(true);
    expect(isIndexablePath('/blog/2')).toBe(true);
  });

  it('접두사만 같은 다른 경로를 잘못 막지 않는다', () => {
    expect(isIndexablePath('/smoketest')).toBe(true);
    expect(isIndexablePath('/blog/smoke-test-post')).toBe(true);
  });
});

describe('buildSeoMeta', () => {
  const ctx = (pathname: string) => ({ pathname, site: SITE });

  it('canonical 은 언제나 자기 자신이다 (페이지네이션 포함)', () => {
    expect(buildSeoMeta({ description: 'x' }, ctx(blogPagePath(1))).canonical).toBe(
      'https://gze1206.net/blog',
    );
    expect(buildSeoMeta({ description: 'x' }, ctx(blogPagePath(2))).canonical).toBe(
      'https://gze1206.net/blog/2',
    );
    expect(buildSeoMeta({ description: 'x' }, ctx('/blog/2/')).canonical).toBe(
      'https://gze1206.net/blog/2',
    );
  });

  it('og:url 은 canonical 과 같다', () => {
    const meta = buildSeoMeta({ description: 'x' }, ctx('/blog/2'));
    expect(meta.ogUrl).toBe(meta.canonical);
  });

  it('기본 og:type 은 website 이고 글 시각을 내지 않는다', () => {
    const meta = buildSeoMeta({ description: 'x' }, ctx('/blog'));
    expect(meta.ogType).toBe('website');
    expect(meta.publishedTime).toBeUndefined();
    expect(meta.modifiedTime).toBeUndefined();
  });

  it('글은 article + 발행/수정 시각을 낸다', () => {
    const meta = buildSeoMeta(
      {
        title: '글 제목',
        description: '글 설명',
        type: 'article',
        article: { publishedTime: '2026-07-01', modifiedTime: '2026-07-20' },
      },
      ctx('/blog/hello-world'),
    );
    expect(meta.ogType).toBe('article');
    expect(meta.publishedTime).toBe('2026-07-01');
    expect(meta.modifiedTime).toBe('2026-07-20');
    expect(meta.title).toBe(`글 제목 · ${SITE_NAME}`);
  });

  it('article 시각은 og:type 이 article 일 때만 나간다', () => {
    const meta = buildSeoMeta(
      { description: 'x', article: { publishedTime: '2026-07-01' } },
      ctx('/blog'),
    );
    expect(meta.publishedTime).toBeUndefined();
  });

  it('description 이 비면 기본 문구로 되돌린다', () => {
    expect(buildSeoMeta({ description: '   ' }, ctx('/')).description).toBe(DEFAULT_DESCRIPTION);
    expect(buildSeoMeta({}, ctx('/')).description).toBe(DEFAULT_DESCRIPTION);
  });

  it('description 의 개행·연속 공백을 한 칸으로 접는다', () => {
    expect(buildSeoMeta({ description: '앞\n  뒤' }, ctx('/')).description).toBe('앞 뒤');
  });

  it('색인 대상 페이지는 그 페이지의 생성 카드를 절대 URL 로 가리킨다 (NOR-28)', () => {
    expect(buildSeoMeta({ description: 'x' }, ctx('/')).ogImage).toBe(
      'https://gze1206.net/og/index.png',
    );
    expect(buildSeoMeta({ description: 'x' }, ctx('/blog/hello-world')).ogImage).toBe(
      'https://gze1206.net/og/blog/hello-world.png',
    );
    expect(buildSeoMeta({ description: 'x' }, ctx(blogPagePath(2))).ogImage).toBe(
      'https://gze1206.net/og/blog/2.png',
    );
  });

  it('색인 대상이 아닌 경로는 정적 폴백을 쓴다 (스모크는 카드를 만들지 않는다)', () => {
    expect(buildSeoMeta({ description: 'x' }, ctx('/smoke/cil')).ogImage).toBe(
      `https://gze1206.net${DEFAULT_OG_IMAGE}`,
    );
    expect(buildSeoMeta({ description: 'x', noindex: true }, ctx('/blog')).ogImage).toBe(
      `https://gze1206.net${DEFAULT_OG_IMAGE}`,
    );
  });

  it('og:image 로 넘긴 루트 상대 경로가 규칙을 이긴다', () => {
    expect(buildSeoMeta({ description: 'x', image: '/custom.png' }, ctx('/')).ogImage).toBe(
      'https://gze1206.net/custom.png',
    );
  });

  it('이미지 규격과 alt 를 함께 낸다 (SNS 레이아웃·접근성)', () => {
    const meta = buildSeoMeta({ title: '글 제목', description: 'x' }, ctx('/blog/hello-world'));
    expect(meta.ogImageWidth).toBe(1200);
    expect(meta.ogImageHeight).toBe(630);
    expect(meta.ogImageType).toBe('image/png');
    expect(meta.ogImageAlt).toBe(`글 제목 · ${SITE_NAME} 대표 이미지`);
  });

  it('og:image 가 이미 절대 URL 이면 그대로 쓴다', () => {
    expect(
      buildSeoMeta({ description: 'x', image: 'https://cdn.example.com/a.png' }, ctx('/')).ogImage,
    ).toBe('https://cdn.example.com/a.png');
  });

  it('스모크 경로는 noindex 다', () => {
    expect(buildSeoMeta({ description: 'x' }, ctx('/smoke/cil')).robots).toBe('noindex, nofollow');
  });

  it('noindex 프롭으로도 막을 수 있다', () => {
    expect(buildSeoMeta({ description: 'x', noindex: true }, ctx('/blog')).robots).toBe(
      'noindex, nofollow',
    );
  });

  it('그 밖의 페이지는 색인을 허용한다', () => {
    expect(buildSeoMeta({ description: 'x' }, ctx('/blog')).robots).toBe(
      'index, follow, max-image-preview:large',
    );
  });

  it('twitter 카드는 항상 summary_large_image 다', () => {
    expect(buildSeoMeta({ description: 'x' }, ctx('/')).twitterCard).toBe('summary_large_image');
  });

  it('사이트 이름·로케일을 함께 낸다', () => {
    const meta = buildSeoMeta({ description: 'x' }, ctx('/'));
    expect(meta.siteName).toBe(SITE_NAME);
    expect(meta.locale).toBe('ko_KR');
  });

  it('홈은 제목이 겹치지 않는다', () => {
    expect(buildSeoMeta({ title: SITE_NAME, description: 'x' }, ctx('/')).title).toBe(SITE_NAME);
  });
});
