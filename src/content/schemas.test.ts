import { describe, expect, it } from 'vitest';
import {
  bookSchema,
  experienceSchema,
  portfolioSchema,
  postSchema,
  profileSchema,
  seriesSchema,
} from './schemas';

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

const validProfile = {
  name: 'gze1206',
  headline: '소프트웨어 개발자',
  introduction: '게임과 웹을 만듭니다.',
  skills: ['C#'],
};

const validExperience = {
  organization: '공개 조직',
  role: '개발자',
  period: '2024.01 — 현재',
  endDate: null,
  highlights: ['공개 성과'],
  visible: true,
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

  it('공개 링크가 없는 작업도 실을 수 있다', () => {
    // 회사 프로젝트는 볼 수 있는 주소가 없다. 링크를 필수로 두면 실제로 한 일 중 큰
    // 덩어리가 포트폴리오에서 빠진다 (NOR-157).
    const parsed = portfolioSchema.parse({ ...validPortfolio, links: [] });

    expect(parsed.links).toEqual([]);
    expect(parsed.media).toEqual([]);
    expect(parsed.highlights).toEqual([]);
  });

  it('이미지는 크기와 대체 텍스트를 함께 요구한다', () => {
    const withImage = {
      ...validPortfolio,
      media: [{ src: '/img/portfolio/a.webp', alt: '스크린샷', width: 1280, height: 720 }],
    };

    expect(portfolioSchema.safeParse(withImage).success).toBe(true);
    expect(
      portfolioSchema.safeParse({
        ...validPortfolio,
        media: [{ src: '/img/portfolio/a.webp', alt: '스크린샷' }],
      }).success,
    ).toBe(false);
    expect(
      portfolioSchema.safeParse({
        ...validPortfolio,
        media: [{ src: '/img/portfolio/a.webp', width: 1280, height: 720 }],
      }).success,
    ).toBe(false);
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

describe('profileSchema', () => {
  it('소개와 기술은 빈 값 없이 입력해야 한다', () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true);
    expect(profileSchema.safeParse({ ...validProfile, skills: [] }).success).toBe(false);
  });
});

describe('experienceSchema', () => {
  it('공개 설정과 기간을 포함한 경력만 허용한다', () => {
    expect(experienceSchema.safeParse(validExperience).success).toBe(true);
    expect(experienceSchema.safeParse({ ...validExperience, visible: undefined }).success).toBe(
      false,
    );
    expect(experienceSchema.safeParse({ ...validExperience, period: undefined }).success).toBe(
      false,
    );
  });
});

it('posts 의 toc 는 기본값이 auto 이고 false 를 받는다', () => {
  const base = {
    title: 't',
    description: 'd',
    slug: 'hello-world',
    category: 'c',
    tags: ['a'],
    publishedAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  expect(postSchema.parse(base).toc).toBe('auto');
  expect(postSchema.parse({ ...base, toc: false }).toc).toBe(false);
  expect(postSchema.parse({ ...base, toc: 'floating' }).toc).toBe('floating');
  expect(() => postSchema.parse({ ...base, toc: 'sidebar' })).toThrow();
});

describe('bookSchema', () => {
  const validBook = {
    title: '니체의 초월자',
    authors: ['프리드리히 니체'],
    status: 'reading',
    format: 'ebook',
    source: 'library',
  };

  it('제목·저자·상태·형태·경로만 있으면 성립한다', () => {
    const parsed = bookSchema.parse(validBook);

    // 읽은 목록은 공개가 기본이다. 감추는 것이 예외다.
    expect(parsed.visible).toBe(true);
    expect(parsed.tags).toEqual([]);
    expect(parsed.translators).toEqual([]);
  });

  it('저자가 없으면 실패한다', () => {
    expect(bookSchema.safeParse({ ...validBook, authors: [] }).success).toBe(false);
  });

  it('모르는 상태·형태는 받지 않는다', () => {
    expect(bookSchema.safeParse({ ...validBook, status: 'skimmed' }).success).toBe(false);
    expect(bookSchema.safeParse({ ...validBook, format: 'pdf' }).success).toBe(false);
  });

  it('ISBN13 은 숫자 13자리만 받는다', () => {
    expect(bookSchema.safeParse({ ...validBook, isbn13: '9788901234567' }).success).toBe(true);
    expect(bookSchema.safeParse({ ...validBook, isbn13: '978-89-0123-456-7' }).success).toBe(false);
  });

  it('표지는 크기를 함께 요구한다', () => {
    expect(
      bookSchema.safeParse({
        ...validBook,
        cover: { src: '/img/books/a.webp', width: 400, height: 600 },
      }).success,
    ).toBe(true);
    expect(
      bookSchema.safeParse({ ...validBook, cover: { src: '/img/books/a.webp' } }).success,
    ).toBe(false);
  });

  it('별점은 1~5 정수만 받는다', () => {
    expect(bookSchema.safeParse({ ...validBook, rating: 5 }).success).toBe(true);
    expect(bookSchema.safeParse({ ...validBook, rating: 6 }).success).toBe(false);
    expect(bookSchema.safeParse({ ...validBook, rating: 3.5 }).success).toBe(false);
  });
});
