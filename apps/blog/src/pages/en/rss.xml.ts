import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getVisiblePosts } from '../../lib/content';
import { toRssItems } from '../../lib/feed';
import { UI } from '../../lib/i18n';
import { SITE_NAME } from '../../lib/site-meta';

/** 영어 글의 RSS 2.0 피드 (NOR-250). 한국어 피드(`/rss.xml`)와 따로 둔다. */
export async function GET(context: APIContext) {
  if (context.site === undefined) {
    throw new Error('RSS 절대 URL을 만들려면 astro.config.mjs의 site 설정이 필요합니다.');
  }

  return rss({
    title: `${SITE_NAME} (English)`,
    description: UI.en.blogDescription,
    site: context.site,
    items: toRssItems(await getVisiblePosts('en'), context.site),
    customData: `<language>${UI.en.rssLanguage}</language>`,
  });
}
