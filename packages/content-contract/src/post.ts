import { z } from 'zod';
import { SLUG_PATTERN } from './slug.js';

const text = z.string().trim().min(1);

/**
 * 목차를 어디에 둘지 (NOR-150).
 * `auto` 상단 + 화면 밖이면 플로팅, `inline` 상단만, `floating` 플로팅만, `false` 없음.
 */
export const TOC_MODES = ['auto', 'inline', 'floating'] as const;
export const tocSchema = z.union([z.enum(TOC_MODES), z.literal(false)]);

/** refine 전의 모양. 키 목록 검사와 strict 변형이 여기서 갈라진다. */
export const postObject = z.object({
  title: text,
  description: text,
  slug: z.string().regex(SLUG_PATTERN),
  category: text,
  tags: z.array(text).min(1),
  series: text.optional(),
  seriesOrder: z.number().int().positive().optional(),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  draft: z.boolean().default(false),
  toc: tocSchema.default('auto'),
});

const seriesPaired = (post: { series?: string | undefined; seriesOrder?: number | undefined }) =>
  (post.series === undefined) === (post.seriesOrder === undefined);
const SERIES_PAIR = {
  message: 'series와 seriesOrder는 둘 다 있거나 둘 다 없어야 합니다',
  path: ['seriesOrder'],
};

/** 블로그가 쓴다. 모르는 키는 버리고 빌드를 깨지 않는다. */
export const postSchema = postObject.refine(seriesPaired, SERIES_PAIR);
/** 워크벤치 발행기가 쓴다. 오타 필드가 공개 저장소로 나가지 않게 모르는 키를 거부한다. */
export const strictPostSchema = postObject.strict().refine(seriesPaired, SERIES_PAIR);

export type Post = z.infer<typeof postSchema>;

/** 직렬화 키 순서. 순서가 고정되어야 Git diff 가 최소가 된다. */
export const POST_FIELD_ORDER = [
  'title',
  'description',
  'slug',
  'category',
  'tags',
  'series',
  'seriesOrder',
  'publishedAt',
  'updatedAt',
  'draft',
  'toc',
] as const satisfies readonly (keyof typeof postObject.shape)[];
