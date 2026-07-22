/**
 * 페이지 메타(`title`·`description`·`canonical`·`robots`·OG/Twitter) 조립의 단일 출처 (NOR-27).
 *
 * 메타는 페이지마다 손으로 나열하면 반드시 어긋난다 — 어떤 페이지는 canonical 이 빠지고, 어떤
 * 페이지는 레이아웃이 중첩되며 `<title>` 이 두 번 들어간다. 그래서 **조립은 여기 순수 함수가
 * 전부 하고**, `SeoMeta.astro` 는 결과를 태그로 펴기만 한다. 메타를 출력하는 곳은
 * `BaseLayout` 한 곳뿐이므로 개수가 0이나 2가 될 수 없다.
 *
 * 절대 URL 은 `Astro.site`(= `astro.config.mjs` 의 `https://gze1206.net`) 를 기준으로 만든다.
 * `base` 는 설정하지 않으므로 경로는 항상 도메인 루트 기준이다.
 *
 * trailing slash 정책은 **없음**(루트 `/` 만 예외) — ADR 0013. `src/lib/routes.ts` 가 만드는
 * 내부 링크와 같은 모양이라 canonical 과 실제 링크가 어긋날 수 없다.
 *
 * ### 후속 일감이 여기서 꺼내 쓸 것
 *
 * | 일감   | 쓰는 것                                                              |
 * | ------ | -------------------------------------------------------------------- |
 * | NOR-29 | {@link absoluteUrl} 로 JSON-LD 의 `@id`·`url` 을 만든다               |
 * | NOR-30 | {@link absoluteUrl} · {@link isIndexablePath} 로 사이트맵 항목을 거른다 |
 *
 * NOR-28(OG 이미지)은 {@link SeoInput.image} 를 쓰지 않고 **경로 규칙**으로 붙었다 —
 * 색인 대상 페이지는 자동으로 `ogImagePath(경로)` 를 가리킨다. 페이지가 이미지를 넘겨줄
 * 필요가 없으므로 "이 페이지만 OG 이미지를 빠뜨렸다" 가 구조적으로 불가능하다.
 */

import { OG_IMAGE_HEIGHT, OG_IMAGE_TYPE, OG_IMAGE_WIDTH } from './og-card';
import { normalizePath, ogImagePath } from './routes';

export const SITE_NAME = 'gze1206.net';
/** `<html lang>` 값. `og:locale` 과 짝이다. */
export const SITE_LANG = 'ko';
export const SITE_LOCALE = 'ko_KR';
/** description 이 비었을 때의 마지막 방어선. 빈 description 을 내보내는 것보다 낫다. */
export const DEFAULT_DESCRIPTION = 'gze1206의 개인 블로그';
/**
 * OG 이미지 폴백.
 *
 * 색인 대상 페이지는 빌드타임에 생성한 per-페이지 카드를 쓴다(NOR-28). 이 정적 1장은
 * **색인 대상이 아닌 경로**(`/smoke/*`)와, 규칙 밖에서 이미지를 못 정한 경우의 마지막 방어선이다.
 */
export const DEFAULT_OG_IMAGE = '/og-default.png';

const TITLE_SUFFIX = ` · ${SITE_NAME}`;

/**
 * 색인에서 제외할 경로 접두사.
 *
 * `/smoke/*` 는 렌더 파이프라인 검증용이라 프로덕션 산출물에 들어가지만 검색 결과에 나오면 안 된다.
 * 페이지가 아니라 **경로**로 판정하므로 스모크 페이지를 새로 추가하는 사람이 메타를 잊을 수 없다.
 * `robots.txt` 의 `Disallow` 와 이중으로 건다(spec NOR-27 결정 3).
 */
const NOINDEX_PREFIXES = ['/smoke'] as const;

const ROBOTS_INDEX = 'index, follow, max-image-preview:large';
const ROBOTS_NOINDEX = 'noindex, nofollow';

/** 페이지 제목에 사이트 이름을 붙인다. 홈처럼 맨 제목이 사이트 이름이면 한 번만 낸다. */
export function formatTitle(pageTitle?: string | undefined): string {
  const trimmed = pageTitle?.trim();
  if (!trimmed || trimmed === SITE_NAME) return SITE_NAME;
  // 호출부가 실수로 접미사까지 넘겨도 `X · gze1206.net · gze1206.net` 이 되지 않게 한다.
  if (trimmed.endsWith(TITLE_SUFFIX)) return trimmed;
  return `${trimmed}${TITLE_SUFFIX}`;
}

/**
 * 경로 정규화는 URL 조립의 단일 출처인 `routes.ts` 가 갖는다 (ADR 0013).
 * canonical 과 내부 링크가 같은 함수를 쓰도록 여기서는 다시 내보내기만 한다.
 */
export { normalizePath };

function isExternalUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * 사이트 절대 URL 을 만든다. `site` 가 없으면 던진다 — 상대 canonical 을 조용히 내보내면
 * 크롤러와 SNS 가 해석하지 못하는데 산출물만 봐서는 알아채기 어렵다.
 */
export function absoluteUrl(path: string, site: URL | string | undefined): string {
  if (site === undefined) {
    throw new Error(
      'absoluteUrl: Astro.site 가 없습니다. astro.config.mjs 의 `site` 를 확인하세요 (NOR-27).',
    );
  }
  return new URL(normalizePath(path), site).href;
}

/** 이 경로를 검색엔진이 색인해도 되는가. */
export function isIndexablePath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return !NOINDEX_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export type OgType = 'website' | 'article';

/** 글의 발행/수정 시각. `derivePostDetail()` 의 ISO 값을 그대로 넘긴다(다시 계산하지 않는다). */
export interface ArticleTimes {
  readonly publishedTime: string;
  readonly modifiedTime?: string | undefined;
}

/** 페이지가 넘기는 메타 재료. 전부 선택값이라 스모크 페이지도 그대로 통과한다. */
export interface SeoInput {
  /** **사이트 이름을 붙이지 않은** 맨 제목. 접미사는 {@link formatTitle} 이 붙인다. */
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  /** 목록·인덱스는 `website`(기본), 글 상세만 `article`. */
  readonly type?: OgType | undefined;
  /**
   * 루트 상대 경로 또는 http(s) 절대 URL.
   *
   * 생략하면 **경로 규칙**으로 정한다(NOR-28): 색인 대상이면 그 페이지의 생성 카드,
   * 아니면 {@link DEFAULT_OG_IMAGE}. 페이지가 직접 넘길 일은 거의 없다.
   */
  readonly image?: string | undefined;
  /** `type: 'article'` 일 때만 반영된다. */
  readonly article?: ArticleTimes | undefined;
  /** 경로 규칙(`/smoke/*`) 밖에서 개별적으로 색인을 막고 싶을 때. */
  readonly noindex?: boolean | undefined;
}

/** 렌더 시점 정보. `Astro.url.pathname` 과 `Astro.site` 를 그대로 넘긴다. */
export interface SeoContext {
  readonly pathname: string;
  readonly site: URL | string | undefined;
}

/** `<head>` 에 그대로 펴 넣을 수 있는, 완성된 메타 값 묶음. */
export interface SeoMeta {
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly robots: string;
  readonly ogType: OgType;
  /** canonical 과 같은 값. og:url 이 canonical 과 어긋나면 SNS 가 다른 페이지를 가리킨다. */
  readonly ogUrl: string;
  readonly ogImage: string;
  /** 카드에 실제로 보이는 내용을 설명한다(제목 + 사이트 이름). */
  readonly ogImageAlt: string;
  /** SNS 가 이미지를 받기 전에 자리를 잡을 수 있도록 규격을 함께 내보낸다. */
  readonly ogImageWidth: number;
  readonly ogImageHeight: number;
  readonly ogImageType: string;
  readonly siteName: string;
  readonly locale: string;
  readonly twitterCard: 'summary_large_image';
  readonly publishedTime?: string | undefined;
  readonly modifiedTime?: string | undefined;
}

function normalizeDescription(description: string | undefined): string {
  const text = description?.replace(/\s+/g, ' ').trim();
  return text ? text : DEFAULT_DESCRIPTION;
}

function resolveImage(
  image: string | undefined,
  pathname: string,
  indexable: boolean,
  site: URL | string | undefined,
): string {
  // 색인 대상 페이지는 빌드타임에 생성한 카드를 쓴다. 색인 대상이 아닌 `/smoke/*` 는
  // 카드를 만들지 않으므로(만들 이유가 없다) 정적 기본 이미지로 둔다.
  const generated = indexable ? ogImagePath(pathname) : DEFAULT_OG_IMAGE;
  const source = image?.trim() || generated;
  // 외부 스토리지에 올린 이미지를 넘기더라도 메타 구조를 바꾸지 않아도 되게 둔다.
  return isExternalUrl(source) ? source : absoluteUrl(source, site);
}

/** 페이지 재료 + 렌더 컨텍스트 → 완성된 메타. 같은 입력은 항상 같은 출력이다. */
export function buildSeoMeta(input: SeoInput, context: SeoContext): SeoMeta {
  const canonical = absoluteUrl(context.pathname, context.site);
  const ogType = input.type ?? 'website';
  const indexable = input.noindex !== true && isIndexablePath(context.pathname);
  // 글이 아닌 페이지에 article:* 을 붙이면 크롤러가 목록을 글로 오인한다.
  const times = ogType === 'article' ? input.article : undefined;
  const title = formatTitle(input.title);

  return {
    title,
    description: normalizeDescription(input.description),
    canonical,
    robots: indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX,
    ogType,
    ogUrl: canonical,
    ogImage: resolveImage(input.image, context.pathname, indexable, context.site),
    ogImageAlt: `${title} 대표 이미지`,
    ogImageWidth: OG_IMAGE_WIDTH,
    ogImageHeight: OG_IMAGE_HEIGHT,
    ogImageType: OG_IMAGE_TYPE,
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    twitterCard: 'summary_large_image',
    publishedTime: times?.publishedTime,
    modifiedTime: times?.modifiedTime,
  };
}
