import { z } from 'zod';

const isoDateSchema = z.coerce.date().transform((value) => value.toISOString().slice(0, 10));
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

export const postSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    slug: slugSchema,
    category: z.string().trim().min(1),
    tags: z.array(z.string().trim().min(1)).min(1),
    series: z.string().trim().min(1).optional(),
    seriesOrder: z.number().int().positive().optional(),
    publishedAt: isoDateSchema,
    updatedAt: isoDateSchema,
    draft: z.boolean().default(false),
  })
  .strict()
  .superRefine((post, context) => {
    if ((post.series === undefined) !== (post.seriesOrder === undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'series and seriesOrder must be provided together',
        path: post.series === undefined ? ['series'] : ['seriesOrder'],
      });
    }
  });

export type PublicPost = z.infer<typeof postSchema>;

export function parsePublishedPost(input: unknown): PublicPost {
  return postSchema.parse(input);
}
