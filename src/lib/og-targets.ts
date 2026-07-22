/**
 * "어떤 페이지에 어떤 OG 카드를 만들 것인가" 의 목록 (NOR-28).
 *
 * 메타(`site-meta.ts`)는 **경로 규칙**으로 `og:image` 를 정하고, 이 모듈은 그 규칙이
 * 가리키는 파일을 실제로 만들 목록을 낸다. 둘이 어긋나면 깨진 참조가 되므로,
 * 경로는 양쪽 모두 `routes.ts` 의 {@link ogImagePath} 하나만 쓴다.
 *
 * 목록이 실제 라우트와 어긋나지 않도록:
 * - 경로는 `routes.ts` 의 헬퍼로만 만든다(문자열 조립 금지).
 * - 대상 집합은 라우트가 쓰는 것과 **같은** `content.ts` 헬퍼에서 파생한다.
 * - 그래도 빠지는 페이지가 있으면 빌드 끝에 `og-image-audit` 통합이 경고한다.
 *
 * `/smoke/*` 는 색인 대상이 아니라(`isIndexablePath`) 카드를 만들지 않는다 — 메타도
 * 정적 기본 이미지를 가리킨다.
 *
 * 이 모듈은 **순수**하다(ADR 0002 와 같은 갈래: 계산과 `astro:content` 접근을 분리한다).
 * 실제 콘텐츠에서 입력을 모으는 일은 엔드포인트(`src/pages/og/[...path].png.ts`)가 한다.
 */

import type { OgCardInput } from './og-card';
import {
  blogPagePath,
  categoryPath,
  ogImageParam,
  ogImagePath,
  postPath,
  seriesPath,
  tagPath,
} from './routes';

/** 만들어야 할 이미지 한 장. */
export interface OgTarget {
  /** 이미지의 사이트 경로. 예: `/og/blog/hello-world.png` */
  readonly path: string;
  /** 엔드포인트 `[...path]` 파라미터(디코딩된 값). 예: `blog/hello-world` */
  readonly param: string;
  readonly card: OgCardInput;
}

/** {@link buildOgTargets} 입력. `astro:content` 를 모르는 평범한 값만 받는다(테스트 가능). */
export interface OgTargetsInput {
  readonly brand: string;
  readonly siteDescription: string;
  readonly posts: readonly {
    readonly slug: string;
    readonly title: string;
    readonly seriesName?: string | undefined;
  }[];
  /** `/blog` 페이지네이션의 마지막 페이지 번호(1 이상). */
  readonly blogPageCount: number;
  readonly categories: readonly {
    readonly slug: string;
    readonly label: string;
    readonly count: number;
  }[];
  readonly tags: readonly {
    readonly slug: string;
    readonly label: string;
    readonly count: number;
  }[];
  readonly seriesList: readonly {
    readonly slug: string;
    readonly name: string;
    readonly description: string;
  }[];
}

function target(path: string, card: OgCardInput): OgTarget {
  return { path: ogImagePath(path), param: ogImageParam(path), card };
}

/**
 * 페이지 목록 → 카드 목록. 같은 입력은 항상 같은 출력이다.
 *
 * 카드 문구는 페이지의 제목·설명과 **뜻이 같게** 맞춰 둔다. 완전히 같은 문자열을 공유하지
 * 않는 이유는, 카드는 1200×630 안에 들어가야 해서 페이지 문구보다 짧아야 할 때가 있어서다.
 */
export function buildOgTargets(input: OgTargetsInput): OgTarget[] {
  const { brand } = input;
  const targets: OgTarget[] = [
    target('/', { kind: 'list', title: brand, description: input.siteDescription, brand }),
    target('/blog', {
      kind: 'list',
      title: '블로그',
      description: 'gze1206이 쓴 글 목록입니다.',
      brand,
    }),
    target('/category', {
      kind: 'list',
      title: '카테고리',
      description: '글을 카테고리별로 모아 봅니다.',
      brand,
    }),
    target('/tags', {
      kind: 'list',
      title: '태그',
      description: '글을 태그별로 모아 봅니다.',
      brand,
    }),
    target('/series', {
      kind: 'list',
      title: '시리즈',
      description: '여러 편으로 이어지는 글 묶음입니다.',
      brand,
    }),
  ];

  // 2페이지부터. `/blog/1` 은 존재하지 않는다(`blogPagePath` 규칙).
  for (let page = 2; page <= input.blogPageCount; page++) {
    targets.push(
      target(blogPagePath(page), {
        kind: 'list',
        title: '블로그',
        eyebrow: `${page} / ${input.blogPageCount} 페이지`,
        description: 'gze1206이 쓴 글 목록입니다.',
        brand,
      }),
    );
  }

  for (const post of input.posts) {
    targets.push(
      target(postPath(post.slug), {
        kind: 'post',
        title: post.title,
        eyebrow: post.seriesName === undefined ? undefined : `시리즈 · ${post.seriesName}`,
        brand,
      }),
    );
  }

  for (const category of input.categories) {
    targets.push(
      target(categoryPath(category.slug), {
        kind: 'list',
        eyebrow: '카테고리',
        title: category.label,
        description: `이 카테고리로 분류된 글 ${category.count}개`,
        brand,
      }),
    );
  }

  for (const tag of input.tags) {
    targets.push(
      target(tagPath(tag.slug), {
        kind: 'list',
        eyebrow: '태그',
        title: `#${tag.label}`,
        description: `이 태그가 붙은 글 ${tag.count}개`,
        brand,
      }),
    );
  }

  for (const series of input.seriesList) {
    targets.push(
      target(seriesPath(series.slug), {
        kind: 'list',
        eyebrow: '시리즈',
        title: series.name,
        description: series.description,
        brand,
      }),
    );
  }

  return targets;
}
