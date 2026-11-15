import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getVisiblePosts } from '../lib/content';
import { toRssItems } from '../lib/feed';
import { DEFAULT_DESCRIPTION, SITE_NAME } from '../lib/site-meta';

/** 공개 글의 설명 요약만 담는 RSS 2.0 피드 (NOR-30). */
export async function GET(context: APIContext) {
  if (context.site === undefined) {
    throw new Error('RSS 절대 URL을 만들려면 astro.config.mjs의 site 설정이 필요합니다.');
  }

  return rss({
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    site: context.site,
    items: toRssItems(await getVisiblePosts(), context.site),
    customData: '<language>ko-KR</language>',
  });
}
