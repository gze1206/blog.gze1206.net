import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { postSchema, seriesSchema, portfolioSchema } from './content/schemas';

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
  schema: postSchema,
});

const series = defineCollection({
  loader: file('src/content/series/index.json'),
  schema: seriesSchema,
});

const portfolio = defineCollection({
  loader: file('src/content/portfolio/index.json'),
  schema: portfolioSchema,
});

export const collections = { posts, series, portfolio };
