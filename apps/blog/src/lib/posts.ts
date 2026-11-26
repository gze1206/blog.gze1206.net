/**
 * 글 목록 조회의 순수 로직 (NOR-16, ADR 0009).
 *
 * `astro:content` 에 의존하지 않도록 **구조적 타입**만 받는다. 덕분에 단위 테스트가 가능하고,
 * 라우트(`src/pages/**`)는 여기 있는 함수만 조합해서 쓴다.
 *
 * 이 모듈이 지키는 불변식:
 * - draft 필터는 {@link selectVisible} 하나만 쓴다. 라우트마다 각자 거르지 않는다.
 * - 슬러그 유일성·시리즈 참조 무결성은 **빌드타임에 예외로 실패**시킨다. 조용히 덮어쓰지 않는다.
 */

import { toSlug } from './slug';

/** 이 모듈이 필요로 하는 최소한의 글 모양. `CollectionEntry<'posts'>` 가 그대로 들어맞는다. */
export interface PostLike {
  readonly id: string;
  readonly data: {
    readonly slug: string;
    readonly category: string;
    readonly tags: readonly string[];
    readonly series?: string | undefined;
    readonly seriesOrder?: number | undefined;
    readonly publishedAt: Date;
    readonly draft: boolean;
    /** 글 언어(NOR-250). 없으면 한국어다. */
    readonly lang?: 'ko' | 'en' | undefined;
    readonly translationKey?: string | undefined;
  };
}

/** 언어 안에서의 글 열쇠. 언어가 다르면 같은 slug 를 쓸 수 있다(NOR-250). */
function slugKey(slug: string, lang: string | undefined): string {
  return `${lang ?? 'ko'}:${slug}`;
}

/** 표시용 원문(label)과 URL 슬러그를 함께 들고 다니는 분류 묶음. */
export interface TaxonomyGroup<T> {
  readonly slug: string;
  readonly label: string;
  readonly posts: readonly T[];
}

/** 콘텐츠 계약이 깨졌을 때 던진다. 빌드를 세우는 것이 목적이다. */
export class ContentIntegrityError extends Error {
  constructor(message: string) {
    super(`[NOR-16] ${message}`);
    this.name = 'ContentIntegrityError';
  }
}

/**
 * draft 제외. **draft 필터의 유일한 출처**다.
 *
 * @param includeDrafts `true` 면 draft 글도 남긴다(개발 서버 전용).
 */
export function selectVisible<T extends PostLike>(
  posts: readonly T[],
  includeDrafts: boolean,
): T[] {
  return includeDrafts ? [...posts] : posts.filter((post) => !post.data.draft);
}

/** publishedAt 내림차순. 같은 날짜는 slug 오름차순으로 고정해 빌드 결과를 결정적으로 만든다. */
export function sortByPublishedDesc<T extends PostLike>(posts: readonly T[]): T[] {
  return [...posts].sort((a, b) => {
    const diff = b.data.publishedAt.getTime() - a.data.publishedAt.getTime();
    return diff !== 0 ? diff : a.data.slug.localeCompare(b.data.slug);
  });
}

/** 원본 프론트매터의 `lang:` 값. 없으면 `ko`. */
function readFrontmatterLang(source: string): string {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? '';
  return /^lang:[ \t]*['"]?([a-z]+)['"]?[ \t]*(?:#.*)?$/m.exec(frontmatter)?.[1] ?? 'ko';
}

/** 원본 파일 텍스트에서 프론트매터의 `slug:` 한 줄만 뽑는다. 못 찾으면 `null`. */
function readFrontmatterSlug(source: string): string | null {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1];
  if (frontmatter === undefined) return null;

  const match = /^slug:[ \t]*(?:'([^']*)'|"([^"]*)"|([^\s#]+))[ \t]*(?:#.*)?$/m.exec(frontmatter);
  if (match === null) return null;

  return match[1] ?? match[2] ?? match[3] ?? null;
}

/**
 * **원본 파일 기준** slug 중복 검출.
 *
 * Astro 의 glob 로더는 프론트매터에 `slug` 가 있으면 그것을 엔트리 `id` 로 쓴다. 그래서
 * slug 가 겹치면 뒤에 로드된 글이 앞의 글을 **덮어쓰고, 빌드는 경고만 남긴 채 성공한다** —
 * 컬렉션 조회 시점에는 이미 글 하나가 사라져 있어서 검출이 불가능하다.
 * 따라서 컬렉션이 아니라 원본 파일 텍스트를 직접 훑는다.
 *
 * @param sources 파일 경로 → 파일 원문. `import.meta.glob(..., { query: '?raw' })` 결과.
 */
export function assertUniqueSourceSlugs(sources: Readonly<Record<string, string>>): void {
  const seen = new Map<string, string>();

  for (const path of Object.keys(sources).sort()) {
    const slug = readFrontmatterSlug(sources[path] ?? '');
    if (slug === null) {
      throw new ContentIntegrityError(
        `'${path}' 의 프론트매터에서 slug 를 읽지 못했습니다. \`slug: 'my-post'\` 형태로 한 줄에 적어주세요.`,
      );
    }

    const key = slugKey(slug, readFrontmatterLang(sources[path] ?? ''));
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new ContentIntegrityError(
        `slug 중복: '${slug}' 를 '${previous}' 와 '${path}' 가 함께 사용합니다. 그대로 두면 한쪽 글이 사라집니다.`,
      );
    }
    seen.set(key, path);
  }
}

/**
 * 컬렉션 엔트리 기준 slug 중복 검출.
 *
 * 현재 로더 구현에서는 {@link assertUniqueSourceSlugs} 가 먼저 걸러내므로 도달하지 않지만,
 * 로더가 바뀌어 id 규칙이 달라져도 불변식이 유지되도록 남겨둔다.
 */
export function assertUniquePostSlugs(posts: readonly PostLike[]): void {
  const seen = new Map<string, string>();
  for (const post of posts) {
    const key = slugKey(post.data.slug, post.data.lang);
    const previous = seen.get(key);
    if (previous !== undefined) {
      throw new ContentIntegrityError(
        `slug 중복: '${post.data.slug}' 를 '${previous}' 와 '${post.id}' 가 함께 사용합니다.`,
      );
    }
    seen.set(key, post.id);
  }
}

/**
 * `/blog/[slug]` 와 `/blog/[...page]` 가 한 디렉터리를 공유하므로,
 * 숫자만으로 된 slug 는 페이지네이션 URL(`/blog/2`)과 충돌한다. 미리 막는다.
 */
export function assertPaginationSafeSlugs(posts: readonly PostLike[]): void {
  for (const post of posts) {
    if (/^\d+$/.test(post.data.slug)) {
      throw new ContentIntegrityError(
        `slug '${post.data.slug}' (${post.id}) 는 숫자만으로 이루어져 페이지네이션 경로 /blog/${post.data.slug} 와 충돌합니다.`,
      );
    }
  }
}

function groupBy<T extends PostLike>(
  posts: readonly T[],
  labelsOf: (post: T) => readonly string[],
  kind: string,
): TaxonomyGroup<T>[] {
  const groups = new Map<string, { label: string; posts: T[] }>();

  for (const post of posts) {
    for (const label of labelsOf(post)) {
      const slug = toSlug(label);
      const existing = groups.get(slug);
      if (existing === undefined) {
        groups.set(slug, { label, posts: [post] });
        continue;
      }
      if (existing.label !== label) {
        throw new ContentIntegrityError(
          `${kind} 슬러그 충돌: '${existing.label}' 과 '${label}' 이 모두 '${slug}' 로 변환됩니다. 표기를 하나로 통일하세요.`,
        );
      }
      // 같은 글이 같은 태그를 중복 기재한 경우까지 세지 않는다.
      if (!existing.posts.includes(post)) existing.posts.push(post);
    }
  }

  return [...groups.entries()]
    .map(([slug, { label, posts: grouped }]) => ({ slug, label, posts: grouped }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}

/** 카테고리별 묶음. 표시 문자열이 다른데 슬러그가 같으면 예외. */
export function groupByCategory<T extends PostLike>(posts: readonly T[]): TaxonomyGroup<T>[] {
  return groupBy(posts, (post) => [post.data.category], '카테고리');
}

/** 태그별 묶음. 표시 문자열이 다른데 슬러그가 같으면 예외. */
export function groupByTag<T extends PostLike>(posts: readonly T[]): TaxonomyGroup<T>[] {
  return groupBy(posts, (post) => post.data.tags, '태그');
}

/**
 * posts.series ↔ series 컬렉션 정합성 검사.
 *
 * - 존재하지 않는 시리즈를 가리키면 실패 (오타로 조용히 빈 시리즈가 생기는 것을 막는다).
 * - 같은 시리즈 안에서 seriesOrder 가 겹치면 실패 (순서가 비결정적이 된다).
 *
 * draft 여부와 무관하게 전수 검사한다 — dev 에서만 터지는 오류를 만들지 않기 위해서다.
 */
export function assertSeriesIntegrity(
  posts: readonly PostLike[],
  knownSeriesIds: ReadonlySet<string>,
): void {
  const orders = new Map<string, Map<number, string>>();

  for (const post of posts) {
    const seriesId = post.data.series;
    if (seriesId === undefined) continue;

    if (!knownSeriesIds.has(seriesId)) {
      throw new ContentIntegrityError(
        `'${post.id}' 가 존재하지 않는 시리즈 '${seriesId}' 를 가리킵니다. src/content/series/index.json 을 확인하세요.`,
      );
    }

    // 스키마(refine)가 series ↔ seriesOrder 동시 존재를 보장한다.
    const order = post.data.seriesOrder;
    if (order === undefined) continue;

    // 번역판은 같은 편 번호를 쓴다. 편 번호는 언어 안에서만 유일하면 된다(NOR-250).
    const orderKey = slugKey(seriesId, post.data.lang);
    const taken = orders.get(orderKey) ?? new Map<number, string>();
    const previous = taken.get(order);
    if (previous !== undefined) {
      throw new ContentIntegrityError(
        `시리즈 '${seriesId}' 의 seriesOrder ${order} 가 중복입니다: '${previous}', '${post.id}'.`,
      );
    }
    taken.set(order, post.id);
    orders.set(orderKey, taken);
  }
}

/** 특정 시리즈의 글을 seriesOrder 오름차순으로. */
export function selectSeriesPosts<T extends PostLike>(posts: readonly T[], seriesId: string): T[] {
  return posts
    .filter((post) => post.data.series === seriesId)
    .sort((a, b) => (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0));
}

/**
 * `translationKey` 는 한국어판의 slug 다(NOR-254). 번역판 댓글 묶음이 이 값으로 한국어판 경로를 정하므로,
 * 한국어 글의 키가 자기 slug 와 다르면 두 언어의 댓글이 갈라진다. 그래서 빌드를 세운다.
 */
export function assertTranslationKeys(posts: readonly PostLike[]): void {
  for (const post of posts) {
    const key = post.data.translationKey;
    if ((post.data.lang ?? 'ko') === 'ko' && key !== undefined && key !== post.data.slug)
      throw new ContentIntegrityError(
        `'${post.id}' 의 translationKey '${key}' 가 slug '${post.data.slug}' 와 다릅니다. 한국어 글의 translationKey 는 자기 slug 여야 합니다.`,
      );
  }
}
