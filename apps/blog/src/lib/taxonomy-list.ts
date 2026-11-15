import type { TaxonomyNodeDetail } from '../islands/TaxonomyMap';
import { formatKoreanDate } from './date';
import { categoryPath, postPath, tagPath } from './routes';

interface Group {
  readonly slug: string;
  readonly label: string;
  readonly posts: readonly {
    readonly data: {
      readonly title: string;
      readonly slug: string;
      readonly category: string;
      readonly publishedAt: Date;
    };
  }[];
}

export function buildTaxonomyDetails(
  categories: readonly Group[],
  tags: readonly Group[],
): Record<string, TaxonomyNodeDetail> {
  const details: Record<string, TaxonomyNodeDetail> = {};
  for (const [kind, groups, kindLabel, path] of [
    ['category', categories, '카테고리', categoryPath],
    ['tag', tags, '태그', tagPath],
  ] as const) {
    for (const group of groups) {
      details[`${kind}:${group.slug}`] = {
        label: group.label,
        kindLabel,
        href: path(group.slug),
        postCount: group.posts.length,
        articles: group.posts.slice(0, 3).map((post) => ({
          title: post.data.title,
          href: postPath(post.data.slug),
          meta: `${post.data.category} · ${formatKoreanDate(post.data.publishedAt)}`,
        })),
      };
    }
  }
  return details;
}
