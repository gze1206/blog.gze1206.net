import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { POST_GLOB } from './lib/post-glob.ts';
import {
  bookSchema,
  experienceSchema,
  portfolioSchema,
  postSchema,
  profileSchema,
  seriesSchema,
} from './content/schemas';

const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: POST_GLOB,
    // 언어가 다르면 같은 slug 를 쓸 수 있다. 영어 글의 id 는 `en/<slug>` 라 한국어 글과 겹치지 않는다(NOR-250).
    generateId: ({ data, entry }) => {
      const slug = typeof data['slug'] === 'string' ? data['slug'] : entry;
      return data['lang'] === 'en' ? `en/${slug}` : slug;
    },
  }),
  schema: postSchema,
});

const series = defineCollection({
  loader: glob({ base: './src/content/series', pattern: '**/*.json' }),
  schema: seriesSchema,
});

const portfolio = defineCollection({
  loader: glob({ base: './src/content/portfolio', pattern: '**/*.json' }),
  schema: portfolioSchema,
});

const profile = defineCollection({
  loader: file('src/content/profile.json', {
    parser: (text) => ({ profile: JSON.parse(text) }),
  }),
  schema: profileSchema,
});

const books = defineCollection({
  loader: glob({ base: './src/content/books', pattern: '**/*.json' }),
  schema: bookSchema,
});

const experience = defineCollection({
  loader: glob({ base: './src/content/experience', pattern: '**/*.json' }),
  schema: experienceSchema,
});

export const collections = { posts, series, portfolio, profile, experience, books };
