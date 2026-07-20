import { describe, expect, it } from 'vitest';
import { postSchema, seriesSchema, portfolioSchema } from './schemas';

const validPost = {
  title: '첫 번째 글',
  description: '블로그 첫 글입니다.',
  slug: 'first-post',
  category: 'dev',
  tags: ['astro', 'typescript'],
  publishedAt: '2026-07-20',
  updatedAt: '2026-07-20',
};

const validPostWithSeries = {
  ...validPost,
  series: 'astro-guide',
  seriesOrder: 1,
};

const validSeries = {
  name: 'Astro 가이드',
  slug: 'astro-guide',
  description: 'Astro 프레임워크 시리즈입니다.',
};

const validPortfolio = {
  title: '블로그 v4',
  summary: '개인 블로그 재구축 프로젝트',
  stack: ['Astro', 'TypeScript', 'Tailwind'],
  links: [{ repo: 'https://github.com/gze1206/blog.gze1206.net' }],
};

describe('postSchema', () => {
  it('모든 필수 필드가 있으면 파싱 성공', () => {
    const result = postSchema.safeParse(validPost);
    expect(result.success).toBe(true);
  });

  it('title 누락 시 파싱 실패', () => {
    const { title: _, ...data } = validPost;
    expect(postSchema.safeParse(data).success).toBe(false);
  });

  it('description 누락 시 파싱 실패', () => {
    const { description: _, ...data } = validPost;
    expect(postSchema.safeParse(data).success).toBe(false);
  });

  it('slug가 영문 kebab-case면 성공', () => {
    expect(postSchema.safeParse({ ...validPost, slug: 'my-first-post' }).success).toBe(true);
  });

  it('slug에 한글 포함 시 실패', () => {
    expect(postSchema.safeParse({ ...validPost, slug: '한글-slug' }).success).toBe(false);
  });

  it('slug에 대문자 포함 시 실패', () => {
    expect(postSchema.safeParse({ ...validPost, slug: 'My-Post' }).success).toBe(false);
  });

  it('slug에 공백 포함 시 실패', () => {
    expect(postSchema.safeParse({ ...validPost, slug: 'my post' }).success).toBe(false);
  });

  it('category 누락 시 실패', () => {
    const { category: _, ...data } = validPost;
    expect(postSchema.safeParse(data).success).toBe(false);
  });

  it('tags가 빈 배열이면 실패', () => {
    expect(postSchema.safeParse({ ...validPost, tags: [] }).success).toBe(false);
  });

  it('tags에 1개 이상이면 성공', () => {
    expect(postSchema.safeParse({ ...validPost, tags: ['astro'] }).success).toBe(true);
  });

  it('series와 seriesOrder 둘 다 있으면 성공', () => {
    expect(postSchema.safeParse(validPostWithSeries).success).toBe(true);
  });

  it('series만 있고 seriesOrder 없으면 실패', () => {
    expect(postSchema.safeParse({ ...validPost, series: 'astro-guide' }).success).toBe(false);
  });

  it('seriesOrder만 있고 series 없으면 실패', () => {
    expect(postSchema.safeParse({ ...validPost, seriesOrder: 1 }).success).toBe(false);
  });

  it('series와 seriesOrder 둘 다 없으면 성공', () => {
    expect(postSchema.safeParse(validPost).success).toBe(true);
  });

  it('publishedAt이 Date로 강제 변환', () => {
    const result = postSchema.safeParse(validPost);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.publishedAt).toBeInstanceOf(Date);
    }
  });

  it('updatedAt이 Date로 강제 변환', () => {
    const result = postSchema.safeParse(validPost);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.updatedAt).toBeInstanceOf(Date);
    }
  });

  it('draft 미지정 시 기본값 false', () => {
    const result = postSchema.safeParse(validPost);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.draft).toBe(false);
    }
  });

  it('draft: true 설정 가능', () => {
    const result = postSchema.safeParse({ ...validPost, draft: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.draft).toBe(true);
    }
  });
});

describe('seriesSchema', () => {
  it('name, slug, description 모두 있으면 성공', () => {
    expect(seriesSchema.safeParse(validSeries).success).toBe(true);
  });

  it('name 누락 시 실패', () => {
    const { name: _, ...data } = validSeries;
    expect(seriesSchema.safeParse(data).success).toBe(false);
  });

  it('slug가 영문 kebab-case면 성공', () => {
    expect(seriesSchema.safeParse({ ...validSeries, slug: 'my-series' }).success).toBe(true);
  });

  it('slug에 한글 포함 시 실패', () => {
    expect(seriesSchema.safeParse({ ...validSeries, slug: '한글-시리즈' }).success).toBe(false);
  });

  it('description 누락 시 실패', () => {
    const { description: _, ...data } = validSeries;
    expect(seriesSchema.safeParse(data).success).toBe(false);
  });
});

describe('portfolioSchema', () => {
  it('모든 필수 필드가 있으면 파싱 성공', () => {
    expect(portfolioSchema.safeParse(validPortfolio).success).toBe(true);
  });

  it('title 누락 시 실패', () => {
    const { title: _, ...data } = validPortfolio;
    expect(portfolioSchema.safeParse(data).success).toBe(false);
  });

  it('summary 누락 시 실패', () => {
    const { summary: _, ...data } = validPortfolio;
    expect(portfolioSchema.safeParse(data).success).toBe(false);
  });

  it('stack이 빈 배열이면 실패', () => {
    expect(portfolioSchema.safeParse({ ...validPortfolio, stack: [] }).success).toBe(false);
  });

  it('links가 빈 배열이면 실패', () => {
    expect(portfolioSchema.safeParse({ ...validPortfolio, links: [] }).success).toBe(false);
  });

  it('links 항목에 유효한 URL만 허용', () => {
    expect(
      portfolioSchema.safeParse({
        ...validPortfolio,
        links: [{ repo: 'not-a-url' }],
      }).success,
    ).toBe(false);
  });

  it('links 항목에 키가 최소 1개 필수', () => {
    expect(
      portfolioSchema.safeParse({
        ...validPortfolio,
        links: [{}],
      }).success,
    ).toBe(false);
  });

  it('thumbnail은 선택적', () => {
    expect(
      portfolioSchema.safeParse({
        ...validPortfolio,
        thumbnail: '/images/blog-v4.png',
      }).success,
    ).toBe(true);
    expect(portfolioSchema.safeParse(validPortfolio).success).toBe(true);
  });
});
