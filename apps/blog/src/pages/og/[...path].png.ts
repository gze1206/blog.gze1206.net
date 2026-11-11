/**
 * OG 이미지 정적 엔드포인트 (NOR-28).
 *
 * `output` 을 지정하지 않은 이 저장소에서 모든 라우트는 프리렌더 대상이다(ADR 0012). 즉
 * 이 파일은 **빌드타임에만** 실행되고, 결과는 `dist/og/**.png` 라는 평범한 정적 파일로 떨어진다.
 * 배포된 사이트에 이미지 생성 코드는 남지 않는다.
 *
 * 경로 규칙은 `routes.ts` 의 `ogImagePath` 하나뿐이라, 메타가 가리키는 URL 과 여기서 만드는
 * 파일이 어긋날 수 없다. 개발 서버에서도 같은 경로로 즉석 렌더되므로 카드를 브라우저에서
 * 바로 확인할 수 있다(`http://localhost:4321/og/blog/<slug>.png`).
 *
 * 여기가 `astro:content` 와 순수 계산이 만나는 유일한 지점이다 — 목록을 만드는 규칙은
 * `og-targets.ts`(순수), 카드를 그리는 일은 `og-render.ts` 가 맡는다.
 */

import type { APIRoute, GetStaticPaths } from 'astro';
import {
  getCategoryGroups,
  getSeriesById,
  getSeriesWithPosts,
  getTagGroups,
  getVisiblePosts,
  POSTS_PER_PAGE,
} from '../../lib/content';
import { OG_IMAGE_TYPE, type OgCardInput } from '../../lib/og-card';
import { renderOgImageOrFallback } from '../../lib/og-render';
import { buildOgTargets, type OgTarget } from '../../lib/og-targets';
import { DEFAULT_DESCRIPTION, SITE_NAME } from '../../lib/site-meta';

/**
 * 콘텐츠에서 만들 카드 목록을 뽑는다.
 *
 * About 페이지(NOR-21)가 생기면 `buildOgTargets` 에 `/about` 한 줄을 더하면 붙는다 —
 * 템플릿(`kind: 'about'`)은 이미 있다.
 */
async function listOgTargets(): Promise<OgTarget[]> {
  const [posts, seriesById, categories, tags, seriesEntries] = await Promise.all([
    getVisiblePosts(),
    getSeriesById(),
    getCategoryGroups(),
    getTagGroups(),
    getSeriesWithPosts(),
  ]);

  return buildOgTargets({
    brand: SITE_NAME,
    siteDescription: DEFAULT_DESCRIPTION,
    posts: posts.map((post) => ({
      slug: post.data.slug,
      title: post.data.title,
      seriesName:
        post.data.series === undefined ? undefined : seriesById.get(post.data.series)?.data.name,
    })),
    // 글이 0개여도 `/blog` 는 존재한다(paginate 가 빈 1페이지를 만든다).
    blogPageCount: Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE)),
    categories: categories.map((group) => ({
      slug: group.slug,
      label: group.label,
      count: group.posts.length,
    })),
    tags: tags.map((group) => ({
      slug: group.slug,
      label: group.label,
      count: group.posts.length,
    })),
    seriesList: seriesEntries.map(({ series }) => ({
      slug: series.data.slug,
      name: series.data.name,
      description: series.data.description,
    })),
  });
}

export const getStaticPaths = (async () => {
  const targets = await listOgTargets();
  return targets.map((target) => ({
    params: { path: target.param },
    props: { card: target.card },
  }));
}) satisfies GetStaticPaths;

interface Props {
  card: OgCardInput;
}

export const GET: APIRoute<Props> = async ({ props }) => {
  // 어떤 실패도 예외로 전파되지 않는다 — 실패하면 기본 이미지 바이트가 온다.
  const png = await renderOgImageOrFallback(props.card);
  return new Response(new Uint8Array(png.buffer, png.byteOffset, png.byteLength), {
    headers: { 'Content-Type': OG_IMAGE_TYPE },
  });
};
