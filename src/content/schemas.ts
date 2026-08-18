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
    /**
     * 목차를 어디에 둘지 (NOR-150).
     *
     * - `auto` — 상단 목차를 열어 두고, 그것이 화면 밖으로 나가면 플로팅 목차를 띄운다.
     * - `inline` — 상단 목차만. 긴 글이 아니어서 따라다닐 필요가 없을 때.
     * - `floating` — 플로팅 목차만. 도입부를 길게 두고 싶을 때.
     * - `false` — 목차 없음.
     *
     * 담을 헤딩이 모자라면 이 값과 무관하게 목차 자체가 생기지 않는다(`buildToc`).
     */
    toc: z.union([z.enum(['auto', 'inline', 'floating']), z.literal(false)]).default('auto'),
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
  /**
   * 홈의 큰 한 줄 (NOR-151). 직함이 아니라 태도를 말하는 자리다.
   * 없으면 `introduction` 을 그대로 쓴다 — 빈 화면을 만드는 것보다 낫다.
   */
  tagline: z.string().min(1).optional(),
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
