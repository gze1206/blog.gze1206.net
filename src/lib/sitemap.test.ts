import { describe, expect, it } from 'vitest';
import { isSitemapPage } from './sitemap';

describe('isSitemapPage', () => {
  it('스모크 경로와 그 하위 페이지만 사이트맵에서 제외한다', () => {
    expect(isSitemapPage('https://gze1206.net/smoke')).toBe(false);
    expect(isSitemapPage('https://gze1206.net/smoke/cil')).toBe(false);
    expect(isSitemapPage('https://gze1206.net/blog/smoke-test-post')).toBe(true);
    expect(isSitemapPage('https://gze1206.net/blog')).toBe(true);
  });
});
