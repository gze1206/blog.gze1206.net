export interface TemplateSummary {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly publicEligible: boolean;
}

import type { BookExcerpt, ReadingMemo } from '../core/document/document.js';

export type { BookExcerpt, ReadingMemo };

/** 책에 딸린 목록 두 가지. 담기는 것은 다르지만 다루는 법은 같다. */
export type BookListName = 'excerpts' | 'memos';

export interface DocumentSummary {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly kind: string;
  readonly updatedAt: string;
  /** 책의 표지 경로(작업 공간 기준). `bookCoverUrl` 로 주소를 만든다. */
  readonly cover?: string;
}

/**
 * 표지 파일을 내려받을 주소.
 *
 * 작업 공간의 파일은 브라우저가 바로 열 수 없으므로 서버를 거친다. `assets/books/` 안의
 * 파일만 나간다 — 목록에 표지를 보이자고 작업 공간 전체를 열어 줄 수는 없다.
 */
export function bookCoverUrl(cover: string): string | null {
  const name = cover.startsWith('assets/books/') ? cover.slice('assets/books/'.length) : null;
  return name === null || name.includes('/')
    ? null
    : `/api/books/cover/${encodeURIComponent(name)}`;
}

export interface DocumentEntry extends DocumentSummary {
  readonly source: string;
  /** 책에서 옮겨 적은 구절. 서버가 풀어서 보낸다. */
  readonly excerpts?: readonly BookExcerpt[];
  /** 읽으면서 남긴 메모. */
  readonly memos?: readonly ReadingMemo[];
  /** 폼이 다루는 책 필드. 브라우저는 frontmatter 를 파싱하지 않는다. */
  readonly book?: BookUpdate;
}

export type BulletType = 'memo' | 'note' | 'event' | 'task';
export type BulletStatus = 'open' | 'completed' | 'cancelled';

export interface Bullet {
  readonly id: string;
  readonly type: BulletType;
  readonly status: BulletStatus;
  readonly text: string;
  readonly migratedFrom?: string;
}

export interface ReviewBullet extends Bullet {
  readonly date: string;
}

export type ReviewKind = 'weekly-review' | 'monthly-review';

export interface ReviewSuggestion {
  readonly kind: ReviewKind;
  readonly period: string;
  readonly endedOn: string;
}

export interface ReviewContext {
  readonly today: string;
  readonly suggestion: ReviewSuggestion | null;
}

export interface BulletReference {
  readonly date: string;
  readonly id: string;
}

export interface PublishReviewData {
  readonly reviewId: string;
  readonly branch: string;
  readonly targetPath: string;
  readonly metadata: {
    readonly title: string;
    readonly description: string;
    readonly slug: string;
    readonly category: string;
    readonly tags: readonly string[];
    readonly series?: string;
    readonly seriesOrder?: number;
    readonly publishedAt: string;
    readonly updatedAt: string;
    readonly draft: boolean;
  };
  readonly assets: readonly string[];
  readonly diff: string;
}

export interface PublishResult {
  readonly outboxRef: string;
  readonly exportRef: string;
  readonly exportFormat: 'bundle' | 'format-patch';
  readonly baseSha: string;
  readonly branch: string;
  readonly commit: string;
  readonly targetPath: string;
}

export interface PublicAssetCandidate {
  readonly id: string;
  readonly reference: string;
  readonly size: number;
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  return request('/api/documents/templates');
}

/** 목록을 만들다 읽지 못한 파일 (NOR-190). */
export interface DocumentProblem {
  readonly relativePath: string;
  readonly message: string;
}

export interface DocumentList {
  readonly documents: DocumentSummary[];
  readonly problems: DocumentProblem[];
}

export async function listDocuments(): Promise<DocumentList> {
  return request('/api/documents');
}

export async function readDocument(id: string): Promise<DocumentEntry> {
  return request(`/api/documents/${encodeURIComponent(id)}`);
}

export async function createDocument(input: {
  readonly templateId: string;
  readonly title: string;
  readonly period?: string;
}): Promise<DocumentEntry> {
  return request('/api/documents', { method: 'POST', body: JSON.stringify(input) });
}

export async function saveDocument(id: string, source: string): Promise<DocumentEntry> {
  return request(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ source }),
  });
}

export async function readDay(
  date: string,
): Promise<{ readonly date: string; readonly bullets: Bullet[] }> {
  return request(`/api/days/${date}`);
}

export async function captureBullet(
  date: string,
  input: { readonly type: BulletType; readonly text: string },
): Promise<Bullet> {
  return request(`/api/days/${date}/bullets`, { method: 'POST', body: JSON.stringify(input) });
}

export async function reviewBullets(before: string): Promise<{ readonly bullets: ReviewBullet[] }> {
  return request(`/api/bullets/review?before=${encodeURIComponent(before)}`);
}

export async function changeBullet(
  date: string,
  id: string,
  action: 'complete' | 'cancel' | 'reopen' | 'cycle-type',
): Promise<Bullet> {
  return request(`/api/days/${date}/bullets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
}

export async function migrateReviewBullet(input: {
  readonly sourceId: string;
  readonly sourceDate: string;
  readonly targetDate: string;
  readonly mode: 'quick' | 'intentional';
  readonly confirmation?: string;
}): Promise<Bullet> {
  return request(`/api/bullets/${input.sourceId}/migrate`, {
    method: 'POST',
    body: JSON.stringify({
      sourceDate: input.sourceDate,
      targetDate: input.targetDate,
      mode: input.mode,
      ...(input.confirmation === undefined ? {} : { confirmation: input.confirmation }),
    }),
  });
}

export async function loadReviewContext(skipped: readonly string[]): Promise<ReviewContext> {
  const query = new URLSearchParams();
  for (const period of skipped) query.append('skipped', period);
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return request(`/api/reviews/suggestion${suffix}`);
}

export async function createReview(input: {
  readonly kind: ReviewKind;
  readonly period: string;
  readonly title?: string;
  readonly bulletReferences?: readonly BulletReference[];
}): Promise<DocumentEntry> {
  return request('/api/reviews', { method: 'POST', body: JSON.stringify(input) });
}

export async function listPublishAssets(id: string): Promise<PublicAssetCandidate[]> {
  return request(`/api/publish/assets/${encodeURIComponent(id)}`);
}

export async function reviewPublish(
  id: string,
  assetIds: readonly string[],
): Promise<PublishReviewData> {
  return request('/api/publish/review', {
    method: 'POST',
    body: JSON.stringify({ id, assetIds }),
  });
}

export async function confirmPublish(
  id: string,
  reviewId: string,
  assetIds: readonly string[],
): Promise<PublishResult> {
  return request('/api/publish/confirm', {
    method: 'POST',
    body: JSON.stringify({ id, assetIds, confirmPublish: true, reviewId }),
  });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const options: RequestInit = init?.body
    ? { ...init, headers: { 'content-type': 'application/json' } }
    : { ...init };
  const response = await fetch(url, options);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(payload?.error?.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

/** 가져올 수 있는 블로그 글 하나 (NOR-187). */
export interface ImportablePost {
  readonly repoPath: string;
  readonly slug: string;
  readonly title: string;
  readonly draft: boolean;
  readonly updatedAt: string;
  /** 작업 공간에서 이미 그 slug 를 쓰고 있는 문서의 경로. 없으면 `null`. */
  readonly conflictsWith: string | null;
}

export type ImportResolution = 'rename' | 'overwrite' | 'skip' | 'cancel';

export interface ImportSelectionInput {
  readonly repoPath: string;
  readonly resolution?: ImportResolution;
  readonly slug?: string;
}

export async function listImportablePosts(): Promise<{
  readonly commit: string;
  readonly posts: ImportablePost[];
}> {
  return request('/api/import/posts');
}

export async function importPosts(selections: readonly ImportSelectionInput[]): Promise<{
  readonly cancelled: boolean;
  readonly imported: string[];
  readonly skipped: { readonly repoPath: string; readonly reason: string }[];
}> {
  return request('/api/import', { method: 'POST', body: JSON.stringify({ selections }) });
}

/** 책 서지정보 조회 결과 (NOR-189). */
export interface BookMetadata {
  readonly title: string;
  readonly authors: readonly string[];
  readonly publisher?: string;
  readonly publishedYear?: number;
  readonly isbn13?: string;
  readonly coverUrl?: string;
  readonly source: string;
}

export interface BookInput {
  readonly title: string;
  readonly authors: string[];
  readonly status: 'reading' | 'finished' | 'abandoned' | 'want';
  readonly format: 'ebook' | 'paper' | 'audio';
  readonly source: 'library' | 'purchase' | 'subscription' | 'borrowed';
  readonly isbn13?: string;
  readonly publisher?: string;
  readonly publishedYear?: number;
  readonly coverUrl?: string;
  /** 이미 올려 둔 표지 경로. 있으면 `coverUrl` 보다 앞선다. */
  readonly cover?: string;
  readonly coverSource?: string;
  readonly startedAt?: string;
  readonly notes?: string;
}

export async function lookupBook(isbn: string): Promise<{
  readonly found: boolean;
  readonly metadata: BookMetadata | null;
}> {
  return request(`/api/books/lookup?isbn=${encodeURIComponent(isbn)}`);
}

/**
 * 표지 파일을 올린다.
 *
 * 국내서는 조회로 표지를 못 구하는 일이 흔해서, 직접 올리는 쪽이 오히려 주된 경로다.
 */
export async function uploadBookCover(
  key: string,
  file: File,
): Promise<{ readonly cover: string }> {
  const response = await fetch(`/api/books/cover?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': file.type },
    body: file,
  });
  const payload = (await response.json().catch(() => null)) as {
    cover?: string;
    error?: { message?: string };
  } | null;
  if (!response.ok || payload?.cover === undefined) {
    throw new Error(payload?.error?.message ?? '표지를 올리지 못했습니다.');
  }
  return { cover: payload.cover };
}

/** 화면이 고칠 수 있는 책 필드 전부. 빠진 것은 "그대로"가 아니라 "비움"이다. */
export interface BookUpdate {
  readonly title: string;
  readonly authors: string[];
  readonly status: BookInput['status'];
  readonly format: BookInput['format'];
  readonly source: BookInput['source'];
  readonly visible: boolean;
  readonly content: string;
  readonly translators?: string[];
  readonly publisher?: string;
  readonly publishedYear?: number;
  readonly isbn13?: string;
  readonly coverSource?: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly rating?: number;
  readonly tags?: string[];
  readonly oneLiner?: string;
  readonly relatedPost?: string;
}

export async function updateBook(documentId: string, update: BookUpdate): Promise<void> {
  await request(`/api/books/${documentId}`, { method: 'PUT', body: JSON.stringify(update) });
}

/**
 * 구절 하나 또는 메모 하나. `memo` 는 구절에만 있다.
 *
 * 없는 값을 `undefined` 로도 받는다 — 서버가 보낸 항목을 그대로 폼에 넣을 수 있어야 한다.
 */
export interface BookListItem {
  readonly text: string;
  readonly page?: number | undefined;
  readonly memo?: string | undefined;
}

/**
 * 목록에 한 줄 더한다. 문서 전체를 다시 쓰지 않는다 — 읽다가 남기는 일은 자주 있고,
 * 그때마다 본문을 통째로 보내면 편집기에서 쓰던 독서 노트를 덮어쓴다.
 */
export async function addBookListItem(
  documentId: string,
  list: BookListName,
  item: BookListItem,
): Promise<void> {
  await request(`/api/books/${documentId}/${list}`, { method: 'POST', body: JSON.stringify(item) });
}

export async function updateBookListItem(
  documentId: string,
  list: BookListName,
  index: number,
  item: BookListItem,
): Promise<void> {
  await request(`/api/books/${documentId}/${list}/${index}`, {
    method: 'PUT',
    body: JSON.stringify(item),
  });
}

export async function deleteBookListItem(
  documentId: string,
  list: BookListName,
  index: number,
): Promise<void> {
  await request(`/api/books/${documentId}/${list}/${index}`, { method: 'DELETE' });
}

export async function createBook(input: BookInput): Promise<{ readonly relativePath: string }> {
  return request('/api/books', { method: 'POST', body: JSON.stringify(input) });
}
