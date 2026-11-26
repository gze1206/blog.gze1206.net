import { z } from 'zod';

import { seriesSchema } from './series.ts';

// 블로그 사이트 콘텐츠(프로필·경력·포트폴리오)의 계약. 워크벤치가 같은 스키마로 검사해 발행한다(NOR-208).
/**
 * 주소는 정해진 scheme 만 받는다(NOR-208 AC-8). 콘텐츠가 자동 병합되므로 `javascript:`·`data:` 를 막는다.
 * 브라우저는 앞뒤 공백·제어 문자를 지우고 해석하므로, 그런 문자가 섞인 주소는 통째로 받지 않는다.
 */
function safeUrl(protocols: readonly string[]) {
  return z.string().refine(
    (value) => {
      if ([...value].some((char) => char.charCodeAt(0) <= 0x20 || char.charCodeAt(0) === 0x7f))
        return false;
      try {
        return protocols.includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: `${protocols.join(', ')} 주소만 쓸 수 있습니다` },
  );
}

const httpUrl = safeUrl(['http:', 'https:']);

/** 사이트 안의 경로(`/img/...`). 다른 출처(`//host`)나 상위 경로(`..`)는 받지 않는다. */
const sitePathSchema = z
  .string()
  .regex(/^\/(?!\/)[A-Za-z0-9._~\-/]+$/u, {
    message: '/ 로 시작하는 사이트 안 경로만 쓸 수 있습니다',
  })
  .refine((value) => !value.split('/').includes('..'), { message: '.. 은 쓸 수 없습니다' });

const portfolioLinkSchema = z
  .object({
    repo: httpUrl.optional(),
    demo: httpUrl.optional(),
    video: httpUrl.optional(),
    article: httpUrl.optional(),
  })
  .refine((link) => Object.values(link).some((v) => v !== undefined), {
    message: 'links 항목에 최소 1개의 URL이 필요합니다',
  });

/**
 * 포트폴리오 이미지 (NOR-157).
 *
 * 크기를 함께 보관한다. 렌더 시점에 알 수 없으면 이미지가 도착할 때 레이아웃이 밀린다.
 * `alt` 는 필수다 — 작업을 설명하는 이미지가 스크린리더에게 침묵하면 그 항목은 반쪽이 된다.
 */
const portfolioMediaSchema = z.object({
  src: sitePathSchema,
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string().min(1).optional(),
});

/** 경력·포트폴리오 기간의 표준 형식(NOR-236·237). 구분자는 앞뒤에 공백 하나를 둔 엔 대시다. */
export const PERIOD_PATTERN = /^(\d{4})\.(0[1-9]|1[0-2]) – (?:(\d{4})\.(0[1-9]|1[0-2])|현재)$/u;

interface Period {
  /** 연×12+월. 비교용이다. */
  readonly start: number;
  /** "현재" 면 null. */
  readonly end: number | null;
  readonly endLabel: string | null;
}

/** 기간을 읽는다. 형식이 틀렸거나 시작이 끝보다 늦으면 이슈를 남기고 null 을 돌려준다. */
function checkPeriod(value: string, context: z.RefinementCtx): Period | null {
  const match = PERIOD_PATTERN.exec(value);
  if (match === null) {
    context.addIssue({
      code: 'custom',
      path: ['period'],
      message: '기간은 "2025.05 – 2025.09" 또는 "2025.05 – 현재" 형식으로 씁니다',
    });
    return null;
  }
  const start = Number(match[1]) * 12 + Number(match[2]);
  const end = match[3] === undefined ? null : Number(match[3]) * 12 + Number(match[4]);
  if (end !== null && start > end) {
    context.addIssue({ code: 'custom', path: ['period'], message: '시작 달이 끝 달보다 늦습니다' });
    return null;
  }
  return { start, end, endLabel: match[3] === undefined ? null : `${match[3]}.${match[4]}` };
}

export const portfolioSchema = z
  .object({
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
    thumbnail: sitePathSchema.optional(),
    /** 영어판(NOR-251). 번역할 글자만 담고, 비면 한국어 값을 쓴다. 이미지 설명은 `media` 순서를 따른다. */
    en: z
      .object({
        title: z.string().min(1).optional(),
        summary: z.string().min(1),
        role: z.string().min(1).optional(),
        stack: z.array(z.string().min(1)).min(1).optional(),
        highlights: z.array(z.string().min(1)).default([]),
        media: z
          .array(z.object({ alt: z.string().min(1), caption: z.string().min(1).optional() }))
          .default([]),
      })
      .optional(),
  })
  // 예정된 작업이 있으므로 포트폴리오는 미래의 끝 달도 받는다(NOR-237).
  .superRefine((value, context) => {
    if (value.period !== undefined) checkPeriod(value.period, context);
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
        url: safeUrl(['http:', 'https:', 'mailto:']),
        /** 화면에 노출할 계정명 등. 없으면 라벨만 보여 준다. */
        handle: z.string().min(1).optional(),
      }),
    )
    .default([]),
  /** 영어판(NOR-251). `linkLabels` 는 한국어 라벨 → 영어 라벨이다. */
  en: z
    .object({
      name: z.string().min(1).optional(),
      headline: z.string().min(1),
      tagline: z.string().min(1).optional(),
      introduction: z.string().min(1),
      about: z.array(z.string().min(1)).default([]),
      linkLabels: z.record(z.string(), z.string().min(1)).default({}),
    })
    .optional(),
});

export const experienceSchema = z
  .object({
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
    /** 영어판(NOR-251). 기간은 한국어판 값을 함께 쓴다. */
    en: z
      .object({
        organization: z.string().min(1).optional(),
        role: z.string().min(1),
        highlights: z.array(z.string().min(1)).min(1),
      })
      .optional(),
  })
  .superRefine((value, context) => {
    const period = checkPeriod(value.period, context);
    if (period === null) return;
    if (period.end === null) {
      if (value.endDate !== null)
        context.addIssue({
          code: 'custom',
          path: ['endDate'],
          message: '기간이 "현재" 면 끝난 날짜를 비웁니다',
        });
      return;
    }
    if (value.endDate === null) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: '끝난 경력은 끝난 날짜가 필요합니다',
      });
      return;
    }
    const endMonth = value.endDate.getUTCFullYear() * 12 + value.endDate.getUTCMonth() + 1;
    if (endMonth !== period.end)
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: `끝난 날짜가 기간의 끝(${period.endLabel ?? ''})과 다릅니다`,
      });
  });

export type Profile = z.input<typeof profileSchema>;
export type Experience = z.input<typeof experienceSchema>;
export type Portfolio = z.input<typeof portfolioSchema>;

/**
 * 사이트 콘텐츠의 자리(저장소 루트 기준). `single` 은 파일 하나, 아니면 디렉터리 아래 `<slug>.json` 이다.
 */
export const SITE_COLLECTIONS = {
  profile: { path: 'apps/blog/src/content/profile.json', single: true, schema: profileSchema },
  experience: { path: 'apps/blog/src/content/experience', single: false, schema: experienceSchema },
  portfolio: { path: 'apps/blog/src/content/portfolio', single: false, schema: portfolioSchema },
  series: { path: 'apps/blog/src/content/series', single: false, schema: seriesSchema },
} as const;

export type SiteCollection = keyof typeof SITE_COLLECTIONS;
