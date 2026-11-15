/**
 * 사이트 콘텐츠(프로필·경력·포트폴리오·시리즈) 편집 계획 (NOR-208).
 *
 * 원본은 공개 저장소의 JSON 이다. 여기서는 바뀔 파일 내용만 계산하고, 읽고 쓰는 일은 어댑터가 한다.
 */
import { SITE_COLLECTIONS, SLUG_PATTERN, type SiteCollection } from '@gze1206/content-contract';

import { formatPrettierJson } from '../publishing/prettierJson.js';

export const SITE_COLLECTION_NAMES = Object.keys(SITE_COLLECTIONS) as SiteCollection[];

/**
 * `baseHash` 는 편집을 시작한 때의 원본 해시다(NOR-208 AC-9). 새 항목은 `null`, 넘기지 않으면 검사하지 않는다.
 */
export type SiteChange = (
  | {
      readonly collection: SiteCollection;
      readonly id: string;
      readonly data: Readonly<Record<string, unknown>>;
    }
  | { readonly collection: SiteCollection; readonly id: string; readonly delete: true }
) & {
  readonly baseHash?: string | null;
  /** 이름을 바꿀 때 옛 id(NOR-220). 경력·포트폴리오에서만 쓴다. */
  readonly renameFrom?: string;
};

/** 이름을 바꿀 수 있는 컬렉션. 시리즈는 글이 파일 이름으로 참조하므로 뺀다. */
export const RENAMEABLE_COLLECTIONS: readonly SiteCollection[] = ['experience', 'portfolio'];

export interface SiteIssue {
  /** 점으로 이은 필드 경로. 항목 전체에 대한 오류는 빈 문자열이다. */
  readonly path: string;
  readonly message: string;
}

export type SitePlan =
  | { readonly kind: 'write'; readonly path: string; readonly content: string }
  | { readonly kind: 'delete'; readonly path: string }
  | { readonly kind: 'noop'; readonly path: string };

export interface SiteEntry {
  readonly collection: SiteCollection;
  readonly id: string;
  readonly data: unknown;
}

export function isSiteCollection(value: unknown): value is SiteCollection {
  return typeof value === 'string' && Object.hasOwn(SITE_COLLECTIONS, value);
}

/** 컬렉션과 id 로 저장소 안 자리를 정한다. 프로필은 하나뿐이라 id 가 `profile` 이어야 한다. */
export function sitePath(collection: SiteCollection, id: string): string {
  if (!isSiteCollection(collection)) throw new Error('invalid site collection');
  const target = SITE_COLLECTIONS[collection];
  if (target.single) {
    if (id !== collection) throw new Error('invalid site content id');
    return target.path;
  }
  if (!SLUG_PATTERN.test(id) || id.length > 80) throw new Error('invalid site content id');
  return `${target.path}/${id}.json`;
}

/** 입력을 계약 스키마로 검사한다. 문제가 없으면 빈 배열이다. */
export function validateSiteChange(change: SiteChange): SiteIssue[] {
  try {
    sitePath(change.collection, change.id);
  } catch (error) {
    return [{ path: '', message: (error as Error).message }];
  }
  if (change.renameFrom !== undefined) {
    const valid =
      RENAMEABLE_COLLECTIONS.includes(change.collection) &&
      !('delete' in change) &&
      change.renameFrom !== change.id &&
      SLUG_PATTERN.test(change.renameFrom) &&
      change.renameFrom.length <= 80;
    if (!valid)
      return [
        {
          path: 'renameFrom',
          message: '경력·포트폴리오만 다른 영문 소문자 이름으로 바꿀 수 있습니다.',
        },
      ];
  }
  if ('delete' in change) {
    return SITE_COLLECTIONS[change.collection].single
      ? [{ path: '', message: '프로필은 지울 수 없습니다.' }]
      : [];
  }
  const result = SITE_COLLECTIONS[change.collection].schema.safeParse(change.data);
  if (!result.success)
    return result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  // 글은 시리즈를 파일 이름으로, 주소는 slug 로 찾는다. 둘이 어긋나면 글이 시리즈에서 빠진다.
  if (change.collection === 'series' && change.data['slug'] !== change.id)
    return [{ path: 'slug', message: 'slug 는 파일 이름과 같아야 합니다.' }];
  return [];
}

/**
 * main 의 원본(`current`)에도, 스키마에도 없는 최상위 키 (NOR-208 AC-9).
 * 이미 있던 키는 남기되, 공개 저장소에 새로 섞여 들어가는 키는 받지 않는다.
 */
export function unknownKeyIssues(
  collection: SiteCollection,
  data: Readonly<Record<string, unknown>>,
  current: string | null,
): SiteIssue[] {
  const known = new Set(Object.keys(SITE_COLLECTIONS[collection].schema.shape));
  if (current !== null) {
    try {
      const parsed: unknown = JSON.parse(current);
      if (parsed !== null && typeof parsed === 'object')
        for (const key of Object.keys(parsed)) known.add(key);
    } catch {
      // 읽지 못한 원본은 기존 키가 없는 것으로 본다.
    }
  }
  return Object.keys(data)
    .filter((key) => !known.has(key))
    .map((key) => ({ path: key, message: '스키마에 없는 새 필드는 쓸 수 없습니다.' }));
}

/** 사이트 콘텐츠 JSON 을 저장소 Prettier 형식으로 쓴다. */
export function formatSiteJson(data: unknown): string {
  return formatPrettierJson(data, { inlineArrayObjects: true });
}

/** 지금 파일 내용(`current`, 없으면 null)에서 바뀔 것을 계산한다. 검사는 먼저 끝났다고 본다. */
export function planSiteChange(change: SiteChange, current: string | null): SitePlan {
  const path = sitePath(change.collection, change.id);
  if ('delete' in change)
    return current === null ? { kind: 'noop', path } : { kind: 'delete', path };
  const content = formatSiteJson(change.data);
  return content === current ? { kind: 'noop', path } : { kind: 'write', path, content };
}
