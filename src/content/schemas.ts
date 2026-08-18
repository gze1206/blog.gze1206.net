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

/**
 * 포트폴리오 이미지 (NOR-157).
 *
 * 크기를 함께 보관한다. 렌더 시점에 알 수 없으면 이미지가 도착할 때 레이아웃이 밀린다.
 * `alt` 는 필수다 — 작업을 설명하는 이미지가 스크린리더에게 침묵하면 그 항목은 반쪽이 된다.
 */
const portfolioMediaSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string().min(1).optional(),
});

export const portfolioSchema = z.object({
  title: z.string(),
  summary: z.string(),
  /** 그 작업에서 맡은 일. 회사 프로젝트는 이것이 링크보다 중요한 정보다. */
  role: z.string().min(1).optional(),
  period: z.string().min(1).optional(),
  stack: z.array(z.string()).min(1),
  /**
   * 공개 링크가 없는 작업도 포트폴리오에 실린다. 회사 프로젝트가 대표적이다 —
   * 링크를 필수로 두면 실제로 한 일 중 큰 덩어리가 빠진다(NOR-157).
   */
  links: z.array(portfolioLinkSchema).default([]),
  media: z.array(portfolioMediaSchema).default([]),
  highlights: z.array(z.string().min(1)).default([]),
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
  /**
   * About 페이지의 본문 문단들 (NOR-156). 홈의 한 줄 소개보다 길게, 어떤 일을 어떻게
   * 하는 사람인지 설명한다. 비어 있으면 About 은 `introduction` 만 보여 준다.
   */
  about: z.array(z.string().min(1)).default([]),
  /**
   * 연락·프로필 링크 (NOR-156). 외부 배지 이미지를 렌더 시점에 불러오지 않는다 —
   * 남의 서버가 느리면 내 페이지가 느려지고, 죽으면 내 페이지가 깨진다.
   */
  links: z
    .array(
      z.object({
        label: z.string().min(1),
        url: z.string().url(),
        /** 화면에 노출할 계정명 등. 없으면 라벨만 보여 준다. */
        handle: z.string().min(1).optional(),
      }),
    )
    .default([]),
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
