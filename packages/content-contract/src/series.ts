import { z } from 'zod';
import { SLUG_PATTERN } from './slug.ts';

export const seriesSchema = z.object({
  name: z.string(),
  slug: z.string().regex(SLUG_PATTERN),
  description: z.string(),
});

export type Series = z.infer<typeof seriesSchema>;
