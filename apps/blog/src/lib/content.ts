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

import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import {
  assertPaginationSafeSlugs,
  assertSeriesIntegrity,
  assertTranslationKeys,
  assertUniquePostSlugs,
  assertUniqueSourceSlugs,
  groupByCategory,
  groupByTag,
  selectSeriesPosts,
  selectVisible,
  sortByPublishedDesc,
  type TaxonomyGroup,
} from './posts';
import { buildSeriesLabels, type SeriesLabel } from './series-nav';
import { findTranslation, type Lang } from './i18n';

export type Post = CollectionEntry<'posts'>;
export type Series = CollectionEntry<'series'>;
type Profile = CollectionEntry<'profile'>;

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
const seriesLabelsCache = new Map<Lang, Promise<Map<string, SeriesLabel>>>();

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
  assertTranslationKeys(allPosts);
  // 분류 슬러그 충돌은 그룹핑 시점에 던진다. 노출 대상만이 아니라 전수로 미리 확인한다.
  groupByCategory(allPosts);
  groupByTag(allPosts);

  return sortByPublishedDesc(selectVisible(allPosts, INCLUDE_DRAFTS));
}

/** 모든 언어의 노출 대상 글 (publishedAt 내림차순). 빌드 1회당 한 번만 계산한다. */
async function getAllVisiblePosts(): Promise<Post[]> {
  visiblePostsCache ??= await loadVisiblePosts();
  return visiblePostsCache;
}

/**
 * 한 언어의 노출 대상 글 (publishedAt 내림차순). 기본은 한국어다 — 홈·목록·분류·시리즈·RSS 같은
 * 기존 한국어 화면은 인자 없이 불러 한국어 글만 받는다(NOR-250).
 */
export async function getVisiblePosts(lang: Lang = 'ko'): Promise<Post[]> {
  return (await getAllVisiblePosts()).filter((post) => post.data.lang === lang);
}

/** 이 글의 다른 언어판(같은 `translationKey`). 공개된 것만 찾는다. */
export async function getTranslation(post: Post): Promise<Post | undefined> {
  return findTranslation(post, await getAllVisiblePosts());
}

/** 홈페이지에 표시할 단일 공개 소개. 파일이 없으면 빌드를 중단한다. */
export async function getProfile(): Promise<Profile> {
  const profile = await getEntry('profile', 'profile');
  if (profile === undefined) {
    throw new Error('src/content/profile.json 소개 콘텐츠를 찾을 수 없습니다. (NOR-136)');
  }
  return profile;
}

/** 시리즈 id → 시리즈 정의. `posts.series` 가 담고 있는 값이 곧 이 id 다. */
export async function getSeriesById(): Promise<Map<string, Series>> {
  const allSeries = await getCollection('series');
  return new Map(allSeries.map((entry) => [entry.id, entry]));
}

/**
 * 글 slug → 시리즈 라벨. 목록 카드·상세 헤더가 같은 값을 쓴다(NOR-241). 언어마다 따로 계산하고,
 * 영어 라벨은 시리즈의 영어 이름이 있으면 그것을 쓴다(NOR-250). 빌드 1회당 언어별로 한 번만 계산한다.
 */
export async function getSeriesLabels(lang: Lang = 'ko'): Promise<Map<string, SeriesLabel>> {
  let labels = seriesLabelsCache.get(lang);
  if (labels === undefined) {
    labels = Promise.all([getVisiblePosts(lang), getSeriesById()]).then(([posts, seriesById]) =>
      buildSeriesLabels(
        posts,
        lang === 'ko'
          ? seriesById
          : new Map(
              [...seriesById].map(([id, series]) => [
                id,
                { data: { ...series.data, name: series.data.en?.name ?? series.data.name } },
              ]),
            ),
      ),
    );
    seriesLabelsCache.set(lang, labels);
  }
  return labels;
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
interface SeriesWithPosts {
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
