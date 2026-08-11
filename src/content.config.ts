import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import {
  experienceSchema,
  portfolioSchema,
  postSchema,
  profileSchema,
  seriesSchema,
} from './content/schemas';

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx,mdoc}' }),
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

const experience = defineCollection({
  loader: glob({ base: './src/content/experience', pattern: '**/*.json' }),
  schema: experienceSchema,
});

export const collections = { posts, series, portfolio, profile, experience };
