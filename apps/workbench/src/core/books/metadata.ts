/**
 * 책 서지정보 (NOR-189).
 *
 * 어디서 가져오는지는 이 모듈이 정하지 않는다. **응답을 우리 모양으로 옮기는 일**만 순수
 * 함수로 두어, 제공처를 바꿔도 갈아끼울 자리가 한 곳으로 남는다. 국내서 커버리지는 제공처마다
 * 다르고 언젠가 바꾸게 된다.
 */

export interface BookMetadata {
  readonly title: string;
  readonly authors: readonly string[];
  readonly publisher?: string;
  readonly publishedYear?: number;
  readonly isbn13?: string;
  /** 표지 원본 주소. 저장은 호출부가 한다 — 등록 시점에 받아 두고 링크로 걸지 않는다. */
  readonly coverUrl?: string;
  /** 어디서 온 정보인지. 화면과 문서에 남긴다. */
  readonly source: string;
}

/** 서지정보 제공처. 구현은 어댑터에 있다. */
export interface BookMetadataProvider {
  lookup(isbn13: string): Promise<BookMetadata | null>;
}

/** ISBN13 은 숫자 13자리다. 하이픈은 흔히 섞여 오므로 걷어낸다. */
export function normalizeIsbn(value: string): string | null {
  const digits = value.replace(/[\s-]/gu, '');
  return /^\d{13}$/u.test(digits) ? digits : null;
}

/** Open Library `jscmd=data` 응답 하나를 옮긴다. */
export function parseOpenLibrary(payload: unknown, isbn13: string): BookMetadata | null {
  const record = pick(pick(payload, `ISBN:${isbn13}`), undefined);
  if (record === undefined) return null;

  const title = text(record['title']);
  if (title === undefined) return null;

  return compact({
    title,
    authors: names(record['authors']),
    publisher: names(record['publishers'])[0],
    publishedYear: year(text(record['publish_date'])),
    isbn13,
    coverUrl: text(field(record['cover'], 'large') ?? field(record['cover'], 'medium')),
    source: 'Open Library',
  });
}

/** Google Books `volumes?q=isbn:` 응답을 옮긴다. Open Library 가 비었을 때의 두 번째 기회다. */
export function parseGoogleBooks(payload: unknown, isbn13: string): BookMetadata | null {
  const items = pick(payload, 'items');
  const first = Array.isArray(items) ? items[0] : undefined;
  const info = pick(first, 'volumeInfo');
  if (info === undefined) return null;

  const title = text(info['title']);
  if (title === undefined) return null;
  const subtitle = text(info['subtitle']);

  return compact({
    title: subtitle === undefined ? title : `${title}: ${subtitle}`,
    authors: strings(info['authors']),
    publisher: text(info['publisher']),
    publishedYear: year(text(info['publishedDate'])),
    isbn13,
    // 썸네일 주소는 http 로 오기도 한다. 받아 두는 쪽이 https 로 다루게 맞춰 준다.
    coverUrl: text(field(info['imageLinks'], 'thumbnail'))?.replace(/^http:/u, 'https:'),
    source: 'Google Books',
  });
}

/**
 * `undefined` 필드를 지운다.
 *
 * `exactOptionalPropertyTypes` 아래에서는 "없는 것"과 "undefined 인 것"이 다르다. 서지정보는
 * 빠진 항목이 흔하므로, 값이 없으면 키 자체를 두지 않는다.
 */
function compact(value: {
  readonly title: string;
  readonly authors: readonly string[];
  readonly publisher: string | undefined;
  readonly publishedYear: number | undefined;
  readonly isbn13: string;
  readonly coverUrl: string | undefined;
  readonly source: string;
}): BookMetadata {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as unknown as BookMetadata;
}

function pick(value: unknown, key: string | undefined): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (key === undefined) return record;
  const next = record[key];
  return typeof next === 'object' && next !== null ? (next as Record<string, unknown>) : undefined;
}

/** 객체의 값 하나를 그대로 꺼낸다. `pick` 은 객체만 돌려주므로 문자열 필드에는 쓸 수 없다. */
function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter((entry) => entry !== undefined) : [];
}

/** Open Library 는 `[{ name }]` 모양으로 준다. */
function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => text(entry) ?? text(pick(entry, undefined)?.['name']))
    .filter((entry) => entry !== undefined);
}

function year(value: string | undefined): number | undefined {
  const match = value === undefined ? null : /(\d{4})/u.exec(value);
  return match === null ? undefined : Number(match[1]);
}

/**
 * ISBN 이 없는 책의 파일 이름.
 *
 * 한글 제목을 그대로 살린다 — 로마자로 옮기면 사람이 목록에서 못 알아본다. 경로에서
 * 위험하거나 셸에서 성가신 글자만 걷어낸다.
 */
export function bookSlug(title: string): string {
  const cleaned = title
    .normalize('NFC')
    .replace(/[/\\?%*:|"<>.]/gu, '')
    .trim()
    .replace(/\s+/gu, '-');
  return cleaned === '' ? 'untitled' : cleaned.slice(0, 60);
}
