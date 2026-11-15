/**
 * 사이트 콘텐츠(프로필·경력·포트폴리오·시리즈) 편집 계획 (NOR-208).
 *
 * 원본은 공개 저장소의 JSON 이다. 여기서는 바뀔 파일 내용만 계산하고, 읽고 쓰는 일은 어댑터가 한다.
 */
import { SITE_COLLECTIONS, SLUG_PATTERN, type SiteCollection } from '@gze1206/content-contract';

import { formatPrettierJson } from '../publishing/prettierJson.js';

export const SITE_COLLECTION_NAMES = Object.keys(SITE_COLLECTIONS) as SiteCollection[];

export type SiteChange =
  | {
      readonly collection: SiteCollection;
      readonly id: string;
      readonly data: Readonly<Record<string, unknown>>;
    }
  | { readonly collection: SiteCollection; readonly id: string; readonly delete: true };

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
  if ('delete' in change) {
    return SITE_COLLECTIONS[change.collection].single
      ? [{ path: '', message: '프로필은 지울 수 없습니다.' }]
      : [];
  }
  const result = SITE_COLLECTIONS[change.collection].schema.safeParse(change.data);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
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
