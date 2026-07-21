import { describe, expect, it } from 'vitest';
import { blogPagePath, categoryPath, postPath, seriesPath, tagPath } from './routes';

describe('postPath', () => {
  it('프론트매터 slug 로 상세 경로를 만든다', () => {
    expect(postPath('hello-world')).toBe('/blog/hello-world');
  });
});

describe('blogPagePath', () => {
  it('1페이지는 /blog 다 (중복 URL 방지)', () => {
    expect(blogPagePath(1)).toBe('/blog');
    expect(blogPagePath(0)).toBe('/blog');
  });

  it('2페이지부터 번호가 붙는다', () => {
    expect(blogPagePath(2)).toBe('/blog/2');
    expect(blogPagePath(11)).toBe('/blog/11');
  });
});

describe('분류 경로', () => {
  it('카테고리·태그·시리즈 경로를 만든다', () => {
    expect(categoryPath('dev')).toBe('/category/dev');
    expect(tagPath('astro')).toBe('/tags/astro');
    expect(seriesPath('astro-guide')).toBe('/series/astro-guide');
  });

  it('한글 슬러그는 퍼센트 인코딩한다', () => {
    expect(tagPath('웹-성능')).toBe(`/tags/${encodeURIComponent('웹-성능')}`);
    expect(categoryPath('회고')).toBe(`/category/${encodeURIComponent('회고')}`);
  });
});
