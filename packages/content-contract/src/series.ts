import { z } from 'zod';
import { SLUG_PATTERN } from './slug.ts';

export const seriesSchema = z.object({
  name: z.string(),
  slug: z.string().regex(SLUG_PATTERN),
  description: z.string(),
  /** 영어 이름과 설명(NOR-250). 영어 글 화면이 쓴다. */
  en: z.object({ name: z.string().min(1), description: z.string().min(1) }).optional(),
});

export type Series = z.infer<typeof seriesSchema>;
