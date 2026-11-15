import { describe, expect, it } from 'vitest';
import {
  aboutPath,
  blogPagePath,
  categoryPath,
  normalizePath,
  ogImageParam,
  ogImagePath,
  portfolioPath,
  postPath,
  seriesPath,
  tagPath,
  topicsPath,
} from './routes';

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

  it('통합 분류 인덱스는 /topics 이다', () => {
    expect(topicsPath()).toBe('/topics');
  });
});

describe('normalizePath', () => {
  it('끝 슬래시를 떼고 루트만 슬래시를 유지한다 (ADR 0013)', () => {
    expect(normalizePath('/blog/')).toBe('/blog');
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('//blog//2//')).toBe('/blog/2');
  });
});

describe('ogImagePath', () => {
  it('사이트 트리를 그대로 /og 아래에 복사한다', () => {
    expect(ogImagePath('/')).toBe('/og/index.png');
    expect(ogImagePath(postPath('hello-world'))).toBe('/og/blog/hello-world.png');
    expect(ogImagePath(blogPagePath(2))).toBe('/og/blog/2.png');
    expect(ogImagePath(categoryPath('dev'))).toBe('/og/category/dev.png');
  });

  it('끝 슬래시가 있어도 같은 결과다', () => {
    expect(ogImagePath('/blog/')).toBe(ogImagePath('/blog'));
  });

  it('입력의 퍼센트 인코딩을 보존한다', () => {
    expect(ogImagePath(tagPath('웹-성능'))).toBe(`/og/tags/${encodeURIComponent('웹-성능')}.png`);
  });
});

describe('ogImageParam', () => {
  it('`/og/` 접두사와 `.png` 확장자를 뗀 값이다', () => {
    expect(ogImageParam('/')).toBe('index');
    expect(ogImageParam(postPath('hello-world'))).toBe('blog/hello-world');
  });

  it('디코딩된 값을 낸다 (Astro 가 출력 경로에서 다시 인코딩한다)', () => {
    expect(ogImageParam(tagPath('웹-성능'))).toBe('tags/웹-성능');
  });

  it('잘못된 퍼센트 시퀀스에도 던지지 않는다', () => {
    expect(() => ogImageParam('/tags/%')).not.toThrow();
  });
});

it('소개·포트폴리오는 고정 경로다', () => {
  expect(aboutPath()).toBe('/about');
  expect(portfolioPath()).toBe('/portfolio');
});
