/**
 * 콘텐츠 컬렉션 ↔ 라우트 사이의 유일한 통로 (NOR-16, ADR 0009).
 *
 * 모든 라우트는 `getCollection('posts')` 를 직접 부르지 않고 이 모듈만 쓴다. 그래야
 * draft 필터·정렬·무결성 검사가 한 곳에만 존재한다. NOR-17/18 도 이 모듈을 재사용한다.
 *
 * draft 정책(ADR 0009):
 * - `astro build` (프로덕션) — draft 는 목록에서도, `/blog/[slug]` 상세에서도 **페이지 자체가 생기지 않는다.**
 * - `astro dev` — draft 를 보여준다. 초안을 브라우저에서 확인하기 위해서다.
 *
 * 무결성 검사는 draft 를 포함한 **전수**를 대상으로 한다. dev 에서만 터지는 오류를 만들지 않기 위해서다.
 */

import { getCollection, type CollectionEntry } from 'astro:content';
import {
  assertPaginationSafeSlugs,
  assertSeriesIntegrity,
  assertUniquePostSlugs,
  assertUniqueSourceSlugs,
  groupByCategory,
  groupByTag,
  selectSeriesPosts,
  selectVisible,
  sortByPublishedDesc,
  type TaxonomyGroup,
} from './posts';

export type Post = CollectionEntry<'posts'>;
export type Series = CollectionEntry<'series'>;

/** 목록 한 페이지에 담는 글 수. 근거는 ADR 0009. */
export const POSTS_PER_PAGE = 10;

/**
 * dev 서버에서만 draft 를 노출한다.
 * `astro build` 는 `import.meta.env.DEV === false` 이므로 프로덕션 산출물에는 draft 가 새지 않는다.
 */
const INCLUDE_DRAFTS = import.meta.env.DEV;

/**
 * 글 원본 파일의 **날것 텍스트**. slug 중복 검출 전용이다.
 *
 * 컬렉션(`getCollection`)만 봐서는 slug 중복을 알 수 없다 — glob 로더가 프론트매터 slug 를
 * 엔트리 id 로 쓰기 때문에, 겹치는 순간 한쪽 글이 경고만 남기고 사라진 뒤라서 셀 수가 없다.
 * 패턴은 `src/content.config.ts` 의 posts 로더와 같아야 한다.
 */
const RAW_POST_SOURCES = import.meta.glob<string>('../content/posts/**/*.{md,mdx,mdoc}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

let visiblePostsCache: Post[] | null = null;

async function loadVisiblePosts(): Promise<Post[]> {
  const [allPosts, allSeries] = await Promise.all([
    getCollection('posts'),
    getCollection('series'),
  ]);

  // --- 콘텐츠 계약 검사: 어긋나면 빌드를 세운다 ---
  assertUniqueSourceSlugs(RAW_POST_SOURCES);
  assertUniquePostSlugs(allPosts);
  assertPaginationSafeSlugs(allPosts);
  assertSeriesIntegrity(allPosts, new Set(allSeries.map((entry) => entry.id)));
  // 분류 슬러그 충돌은 그룹핑 시점에 던진다. 노출 대상만이 아니라 전수로 미리 확인한다.
  groupByCategory(allPosts);
  groupByTag(allPosts);

  return sortByPublishedDesc(selectVisible(allPosts, INCLUDE_DRAFTS));
}

/** 노출 대상 글 전체 (publishedAt 내림차순). 빌드 1회당 한 번만 계산한다. */
export async function getVisiblePosts(): Promise<Post[]> {
  visiblePostsCache ??= await loadVisiblePosts();
  return visiblePostsCache;
}

/** 시리즈 id → 시리즈 정의. `posts.series` 가 담고 있는 값이 곧 이 id 다. */
export async function getSeriesById(): Promise<Map<string, Series>> {
  const allSeries = await getCollection('series');
  return new Map(allSeries.map((entry) => [entry.id, entry]));
}

/** 프론트매터 slug 로 글 하나를 찾는다. 노출 대상이 아니면 `undefined`. */
export async function findPostBySlug(slug: string): Promise<Post | undefined> {
  const posts = await getVisiblePosts();
  return posts.find((post) => post.data.slug === slug);
}

/** 노출 대상 글 기준 카테고리 묶음 (라벨 가나다순). */
export async function getCategoryGroups(): Promise<TaxonomyGroup<Post>[]> {
  return groupByCategory(await getVisiblePosts());
}

/** 노출 대상 글 기준 태그 묶음 (라벨 가나다순). */
export async function getTagGroups(): Promise<TaxonomyGroup<Post>[]> {
  return groupByTag(await getVisiblePosts());
}

/** 시리즈 정의 + 그 시리즈의 노출 대상 글(seriesOrder 오름차순). */
export interface SeriesWithPosts {
  readonly series: Series;
  readonly posts: readonly Post[];
}

/**
 * 노출 대상 글이 1개 이상인 시리즈만 돌려준다.
 *
 * 글이 하나도 없는 시리즈는 페이지를 만들지 않는다 — 정적 사이트에서 빈 조합에 URL 을 주면
 * 얇은 페이지만 늘어난다. 대신 `/series` 인덱스가 빈 상태를 표시한다.
 */
export async function getSeriesWithPosts(): Promise<SeriesWithPosts[]> {
  const [allSeries, posts] = await Promise.all([getCollection('series'), getVisiblePosts()]);

  return allSeries
    .map((series) => ({ series, posts: selectSeriesPosts(posts, series.id) }))
    .filter((entry) => entry.posts.length > 0)
    .sort((a, b) => a.series.data.name.localeCompare(b.series.data.name, 'ko'));
}
