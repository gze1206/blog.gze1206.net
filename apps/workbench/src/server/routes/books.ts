import { Hono } from 'hono';
import { z } from 'zod';

import { normalizeIsbn, type BookMetadataProvider } from '../../core/books/metadata.js';
import {
  parseDocument,
  serializeDocument,
  type WorkbenchDocument,
} from '../../core/document/document.js';
import type { FileStore } from '../../core/ports.js';
import type { BookAssetStore } from '../adapters/bookAssets.js';
import { encodeDocumentId, isDocumentId } from '../documentIds.js';

/**
 * 읽은 책 관리 (NOR-189).
 *
 * 조회와 등록을 나눈다. 조회는 화면을 채워 주기만 하고, 파일은 사람이 등록을 누를 때 생긴다.
 * 서지정보 제공처가 국내서를 잘 모르는 일이 흔해서, **수기 입력이 기본이고 조회는 보조**다.
 */
const createSchema = z
  .object({
    title: z.string().min(1),
    authors: z.array(z.string().min(1)).min(1),
    status: z.enum(['reading', 'finished', 'abandoned', 'want']),
    format: z.enum(['ebook', 'paper', 'audio']),
    source: z.enum(['library', 'purchase', 'subscription', 'borrowed']),
    translators: z.array(z.string().min(1)).optional(),
    publisher: z.string().min(1).optional(),
    publishedYear: z.number().int().optional(),
    isbn13: z.string().optional(),
    coverUrl: z.string().url().optional(),
    /** 이미 올려 둔 표지의 작업 공간 기준 경로. `POST /api/books/cover` 가 돌려준 값이다. */
    cover: z
      .string()
      .regex(/^assets\/books\/[^/]+$/u, '표지 경로가 올바르지 않습니다.')
      .optional(),
    coverSource: z.string().min(1).optional(),
    startedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .optional(),
    finishedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .optional(),
    rating: z.number().int().min(1).max(5).optional(),
    tags: z.array(z.string().min(1)).optional(),
    oneLiner: z.string().min(1).optional(),
    notes: z.string().optional(),
    visible: z.boolean().optional(),
  })
  .strict();

/**
 * 구절 하나 (NOR-189).
 *
 * `text` 는 옮겨 적은 저자의 말, `note` 는 그 자리에 붙인 내 생각이다. 책 전체를 향한 메모는
 * 여기가 아니라 문서 본문에 쓴다.
 */
const excerptSchema = z
  .object({
    page: z.number().int().positive().optional(),
    text: z.string().min(1),
    /** 이 구절에 대한 메모. 책 전체를 향한 것은 독서 메모(`memos`)로 간다. */
    memo: z.string().min(1).optional(),
  })
  .strict();

/** 읽으면서 남긴 메모. 옮길 문장이 없어도 남긴다. */
const readingMemoSchema = z
  .object({
    page: z.number().int().positive().optional(),
    text: z.string().min(1),
  })
  .strict();

/**
 * 화면이 고칠 수 있는 책 필드 전부 (NOR-189).
 *
 * 조각(patch)이 아니라 **화면이 아는 필드 전체**를 받는다. 빠진 필드는 "그대로 두기"가 아니라
 * "비우기"다 — 폼이 모든 칸을 알고 있으므로, 지우려고 비운 칸과 안 보낸 칸을 구분하느라
 * 규칙을 만들 이유가 없다.
 *
 * 여기 없는 것은 화면이 건드리지 않는다: `excerpts` 와 `cover` 는 각자의 길이 있고,
 * `kind`·`createdAt` 은 바뀌지 않으며, 알 수 없는 필드(`extra`)는 손대지 않고 보존한다.
 */
const updateSchema = z
  .object({
    title: z.string().min(1),
    authors: z.array(z.string().min(1)).min(1),
    status: z.enum(['reading', 'finished', 'abandoned', 'want']),
    format: z.enum(['ebook', 'paper', 'audio']),
    source: z.enum(['library', 'purchase', 'subscription', 'borrowed']),
    visible: z.boolean(),
    content: z.string(),
    translators: z.array(z.string().min(1)).optional(),
    publisher: z.string().min(1).optional(),
    publishedYear: z.number().int().optional(),
    isbn13: z
      .string()
      .regex(/^\d{13}$/u)
      .optional(),
    coverSource: z.string().min(1).optional(),
    startedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .optional(),
    finishedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u)
      .optional(),
    rating: z.number().int().min(1).max(5).optional(),
    tags: z.array(z.string().min(1)).optional(),
    oneLiner: z.string().min(1).optional(),
    relatedPost: z.string().min(1).optional(),
  })
  .strict();

export interface BookRouteOptions {
  readonly today: () => string;
  readonly slugify: (title: string) => string;
}

export function createBookRoutes(
  store: FileStore,
  provider: BookMetadataProvider,
  assets: BookAssetStore,
  options: BookRouteOptions,
): Hono {
  const routes = new Hono();

  /** 주소의 문서 번호로 책을 찾는다. 책이 아닌 문서에는 이 길들이 닿지 않는다. */
  async function findBook(
    id: string,
  ): Promise<{ relativePath: string } | { error: object; status: 400 | 404 }> {
    if (!isDocumentId(id)) {
      return {
        error: { error: { code: 'invalid_id', message: '잘못된 문서입니다.' } },
        status: 400,
      };
    }
    const { documents } = await store.listDocuments();
    const target = documents.find((document) => encodeDocumentId(document.relativePath) === id);
    if (target === undefined || target.kind !== 'book') {
      return {
        error: { error: { code: 'not_found', message: '책을 찾지 못했습니다.' } },
        status: 404,
      };
    }
    return { relativePath: target.relativePath };
  }

  /**
   * 파일을 읽어 고쳐 쓴다.
   *
   * 읽고 쓰는 사이를 한 함수 안에 묶어 두면, 고치는 규칙마다 "파싱하고 직렬화하는" 절차를
   * 다시 적지 않아도 된다. `extra`(모르는 필드)는 손대지 않으므로 사람이 손으로 넣어 둔 것이
   * 화면을 거쳤다고 사라지지 않는다.
   */
  async function writeBook(
    relativePath: string,
    change: (document: WorkbenchDocument) => WorkbenchDocument,
  ): Promise<string> {
    const entry = await store.readDocument(relativePath);
    const updated = change(parseDocument(entry.source));
    await store.writeDocument(relativePath, serializeDocument(updated));
    return relativePath;
  }

  routes.get('/api/books/lookup', async (context) => {
    const isbn = normalizeIsbn(context.req.query('isbn') ?? '');
    if (isbn === null) {
      return context.json(
        { error: { code: 'invalid_isbn', message: 'ISBN13 13자리를 입력하세요.' } },
        400,
      );
    }
    const metadata = await provider.lookup(isbn);
    // 못 찾는 것은 오류가 아니다. 국내서는 자주 비어 있고, 그때는 사람이 적는다.
    return context.json({ found: metadata !== null, metadata });
  });

  /**
   * 표지 파일을 올린다.
   *
   * 등록보다 먼저 오는 이유는 화면에서 미리 보여 주기 위해서다. 아직 책 문서가 없어도 표지는
   * 저장할 수 있다 — 파일 이름만 정해지면 되고, 그 이름은 폼이 이미 알고 있다.
   */
  routes.get('/api/books/cover/:name', async (context) => {
    const cover = await assets.readCover(context.req.param('name'));
    if (cover === null) {
      return context.json({ error: { code: 'not_found', message: '표지가 없습니다.' } }, 404);
    }
    return context.body(toArrayBuffer(cover.bytes), 200, {
      'content-type': cover.contentType,
      // 표지는 내용이 바뀌지 않는다. 바뀌면 파일 이름이 바뀐다.
      'cache-control': 'private, max-age=86400',
    });
  });

  routes.post('/api/books/cover', async (context) => {
    const contentType = context.req.header('content-type') ?? '';
    const key = context.req.query('key') ?? '';
    if (key.trim() === '') {
      return context.json(
        { error: { code: 'invalid_request', message: '표지의 이름이 필요합니다.' } },
        400,
      );
    }

    const bytes = new Uint8Array(await context.req.arrayBuffer());
    const cover = await assets.saveCoverBytes(key, bytes, contentType);
    if (cover === null) {
      return context.json(
        {
          error: {
            code: 'invalid_cover',
            message: 'JPEG·PNG·WebP 이미지만 5MB 까지 올릴 수 있습니다.',
          },
        },
        400,
      );
    }
    return context.json({ cover }, 201);
  });

  /** 책 한 권을 통째로 고친다. 사람이 마크다운을 짜 맞추지 않아도 되게. */
  routes.put('/api/books/:id', async (context) => {
    const found = await findBook(context.req.param('id'));
    if ('error' in found) return context.json(found.error, found.status);

    const input = updateSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) {
      return context.json(
        { error: { code: 'invalid_request', message: '책 정보가 올바르지 않습니다.' } },
        400,
      );
    }
    const { content, ...fields } = input.data;

    /*
      제목은 고칠 수 있지만 **파일 이름은 그대로 둔다**. 파일이 옮겨 다니면 이미 걸어 둔
      링크와 표지 파일의 짝이 끊긴다.
    */
    const written = await writeBook(found.relativePath, (document) => ({
      kind: document.kind,
      createdAt: document.createdAt,
      updatedAt: options.today(),
      ...(document.cover === undefined ? {} : { cover: document.cover }),
      ...(document.excerpts === undefined ? {} : { excerpts: document.excerpts }),
      ...(document.memos === undefined ? {} : { memos: document.memos }),
      ...fields,
      content,
      extra: document.extra,
    }));
    return context.json({ relativePath: written }, 200);
  });

  /*
    구절과 독서 메모는 담기는 것이 다를 뿐 다루는 법이 같다 — 더하고, 고치고, 지운다.
    같은 절차를 두 번 적으면 한쪽만 고치는 날이 온다.

    문서 전체를 다시 쓰게 하지 않는 이유: 읽다가 한 줄 남기는 일은 자주 있고, 그때마다 본문을
    통째로 보내면 편집기에서 독서 노트를 쓰던 것과 서로 덮어쓴다.
  */
  const lists = {
    excerpts: { schema: excerptSchema, message: '옮긴 문장이 있어야 구절입니다.' },
    memos: { schema: readingMemoSchema, message: '남길 말이 있어야 메모입니다.' },
  } as const;

  type ListName = keyof typeof lists;

  function readList(field: string): ListName | null {
    return field === 'excerpts' || field === 'memos' ? field : null;
  }

  routes.post('/api/books/:id/:field', async (context) => {
    const field = readList(context.req.param('field'));
    if (field === null) {
      return context.json({ error: { code: 'not_found', message: '없는 목록입니다.' } }, 404);
    }
    const found = await findBook(context.req.param('id'));
    if ('error' in found) return context.json(found.error, found.status);

    const input = lists[field].schema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) {
      return context.json(
        { error: { code: 'invalid_request', message: lists[field].message } },
        400,
      );
    }

    const today = options.today();
    const written = await writeBook(found.relativePath, (document) => ({
      ...document,
      updatedAt: today,
      [field]: [...(document[field] ?? []), { ...input.data, addedAt: today }],
    }));
    return context.json({ relativePath: written }, 201);
  });

  routes.put('/api/books/:id/:field/:index', async (context) => {
    const field = readList(context.req.param('field'));
    if (field === null) {
      return context.json({ error: { code: 'not_found', message: '없는 목록입니다.' } }, 404);
    }
    const found = await findBook(context.req.param('id'));
    if ('error' in found) return context.json(found.error, found.status);

    const input = lists[field].schema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) {
      return context.json(
        { error: { code: 'invalid_request', message: lists[field].message } },
        400,
      );
    }

    const index = Number(context.req.param('index'));
    let missing = false;
    const written = await writeBook(found.relativePath, (document) => {
      const items = [...(document[field] ?? [])];
      const current = items[index];
      if (current === undefined) {
        missing = true;
        return document;
      }
      // 남긴 날은 그대로 둔다. 오타를 고쳤다고 읽은 날이 바뀌지는 않는다.
      items[index] = {
        ...input.data,
        ...(current.addedAt === undefined ? {} : { addedAt: current.addedAt }),
      };
      return { ...document, updatedAt: options.today(), [field]: items };
    });
    if (missing) {
      return context.json({ error: { code: 'not_found', message: '없는 항목입니다.' } }, 404);
    }
    return context.json({ relativePath: written }, 200);
  });

  routes.delete('/api/books/:id/:field/:index', async (context) => {
    const field = readList(context.req.param('field'));
    if (field === null) {
      return context.json({ error: { code: 'not_found', message: '없는 목록입니다.' } }, 404);
    }
    const found = await findBook(context.req.param('id'));
    if ('error' in found) return context.json(found.error, found.status);

    const index = Number(context.req.param('index'));
    let missing = false;
    const written = await writeBook(found.relativePath, (document) => {
      const items = [...(document[field] ?? [])];
      if (items[index] === undefined) {
        missing = true;
        return document;
      }
      items.splice(index, 1);
      return {
        ...document,
        updatedAt: options.today(),
        // 마지막 하나를 지우면 키 자체를 없앤다. 빈 목록을 남겨 둘 이유가 없다.
        [field]: items.length === 0 ? undefined : items,
      };
    });
    if (missing) {
      return context.json({ error: { code: 'not_found', message: '없는 항목입니다.' } }, 404);
    }
    return context.json({ relativePath: written }, 200);
  });

  routes.post('/api/books', async (context) => {
    const input = createSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) {
      return context.json(
        { error: { code: 'invalid_request', message: '책 정보가 올바르지 않습니다.' } },
        400,
      );
    }
    const book = input.data;
    const isbn13 =
      book.isbn13 === undefined ? undefined : (normalizeIsbn(book.isbn13) ?? undefined);

    /*
      표지는 두 갈래로 온다. 사람이 올린 것이 이미 있으면 그것을 쓰고, 없으면 조회가 알려 준
      주소에서 받는다. 올린 쪽이 먼저다 — 사람이 고른 표지를 남의 서버 것으로 덮을 이유가 없다.
      받는 데 실패해도 등록은 계속된다.
    */
    const cover =
      book.cover ??
      (book.coverUrl === undefined
        ? null
        : await assets.saveCover(isbn13 ?? options.slugify(book.title), book.coverUrl));

    const today = options.today();
    const source = serializeDocument({
      title: book.title,
      kind: 'book',
      createdAt: today,
      updatedAt: today,
      authors: book.authors,
      status: book.status,
      format: book.format,
      source: book.source,
      visible: book.visible ?? true,
      ...optional('translators', book.translators),
      ...optional('publisher', book.publisher),
      ...optional('publishedYear', book.publishedYear),
      ...optional('isbn13', isbn13),
      ...optional('cover', cover ?? undefined),
      ...optional('coverSource', book.coverSource),
      ...optional('startedAt', book.startedAt),
      ...optional('finishedAt', book.finishedAt),
      ...optional('rating', book.rating),
      ...optional('tags', book.tags),
      ...optional('oneLiner', book.oneLiner),
      content: book.notes ?? '',
      extra: {},
    });

    const relativePath = `books/${isbn13 ?? options.slugify(book.title)}.md`;
    try {
      const entry = await store.importDocument({ relativePath, source, overwrite: false });
      return context.json({ relativePath: entry.relativePath, cover }, 201);
    } catch (error) {
      if ((error as { code?: string }).code === 'EEXIST') {
        return context.json({ error: { code: 'conflict', message: '이미 등록된 책입니다.' } }, 409);
      }
      throw error;
    }
  });

  return routes;
}

/** Buffer 는 더 큰 메모리를 나눠 쓰기도 한다. 그 조각만 떼어 낸다. */
function toArrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function optional<K extends string, V>(key: K, value: V | undefined): Record<K, V> | object {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}
