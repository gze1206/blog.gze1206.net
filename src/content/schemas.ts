import { z } from 'astro/zod';
import { SLUG_PATTERN } from './slug-pattern';

const slugSchema = z.string().regex(SLUG_PATTERN);

const portfolioLinkSchema = z
  .object({
    repo: z.string().url().optional(),
    demo: z.string().url().optional(),
    video: z.string().url().optional(),
    article: z.string().url().optional(),
  })
  .refine((link) => Object.values(link).some((v) => v !== undefined), {
    message: 'links 항목에 최소 1개의 URL이 필요합니다',
  });

export const postSchema = z
  .object({
    title: z.string(),
    description: z.string(),
    slug: slugSchema,
    category: z.string(),
    tags: z.array(z.string()).min(1),
    series: z.string().optional(),
    seriesOrder: z.number().int().positive().optional(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    draft: z.boolean().default(false),
  })
  .refine(
    (data) => {
      const hasSeries = data.series !== undefined;
      const hasOrder = data.seriesOrder !== undefined;
      return hasSeries === hasOrder;
    },
    { message: 'series와 seriesOrder는 둘 다 있거나 둘 다 없어야 합니다' },
  );

export const seriesSchema = z.object({
  name: z.string(),
  slug: slugSchema,
  description: z.string(),
});

export const portfolioSchema = z.object({
  title: z.string(),
  summary: z.string(),
  stack: z.array(z.string()).min(1),
  links: z.array(portfolioLinkSchema).min(1),
  thumbnail: z.string().optional(),
});

export const profileSchema = z.object({
  name: z.string().min(1),
  headline: z.string().min(1),
  introduction: z.string().min(1),
  skills: z.array(z.string().min(1)).min(1),
});

export const experienceSchema = z.object({
  organization: z.string().min(1),
  role: z.string().min(1),
  period: z.string().min(1),
  endDate: z.coerce
    .date()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  highlights: z.array(z.string().min(1)).min(1),
  visible: z.boolean(),
});
