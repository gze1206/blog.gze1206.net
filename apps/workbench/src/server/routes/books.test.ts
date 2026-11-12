import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { BookMetadata } from '../../core/books/metadata.js';
import { parseDocument } from '../../core/document/document.js';
import { BookAssetStore } from '../adapters/bookAssets.js';
import { encodeDocumentId } from '../documentIds.js';
import { ServerFileStore } from '../adapters/fileStore.js';
import { createBookRoutes } from './books.js';

const options = {
  today: () => '2026-08-19',
  slugify: (title: string) => title.replace(/\s+/gu, '-'),
};

async function workspace(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'workbench-books-'));
}

function provider(metadata: BookMetadata | null) {
  return { lookup: async () => metadata };
}

function coverResponse(bytes: Uint8Array, contentType = 'image/jpeg'): Response {
  return {
    ok: true,
    headers: { get: () => contentType },
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Response;
}

describe('GET /api/books/cover/:name', () => {
  async function withCover(): Promise<ReturnType<typeof createBookRoutes>> {
    const root = await workspace();
    const routes = createBookRoutes(
      new ServerFileStore(root),
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );
    await routes.request('/api/books/cover?key=9788901234567', {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg' },
      body: new Uint8Array([0xff, 0xd8, 0xff]),
    });
    return routes;
  }

  it('저장해 둔 표지를 그림으로 내준다', async () => {
    const routes = await withCover();

    const response = await routes.request('/api/books/cover/9788901234567.jpg');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([0xff, 0xd8, 0xff]),
    );
  });

  it('없는 표지는 404 다', async () => {
    const routes = await withCover();

    expect((await routes.request('/api/books/cover/9780000000000.jpg')).status).toBe(404);
  });

  /** 표지를 보이자고 작업 공간 전체를 열어 줄 수는 없다. */
  it('표지 디렉터리 밖으로 나가지 못한다', async () => {
    const routes = await withCover();

    for (const name of ['..%2F..%2Fbooks%2F9788901234567.md', '..%2F..%2F.env', 'a%2Fb.jpg']) {
      expect((await routes.request(`/api/books/cover/${name}`)).status).toBe(404);
    }
  });

  it('그림이 아닌 확장자는 내주지 않는다', async () => {
    const routes = await withCover();

    expect((await routes.request('/api/books/cover/9788901234567.md')).status).toBe(404);
  });
});

describe('POST /api/books/cover', () => {
  it('올린 표지를 저장하고 경로를 돌려준다', async () => {
    const root = await workspace();
    const routes = createBookRoutes(
      new ServerFileStore(root),
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );

    const response = await routes.request('/api/books/cover?key=9788901234567', {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg' },
      body: new Uint8Array([0xff, 0xd8, 0xff]),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ cover: 'assets/books/9788901234567.jpg' });
    expect(await readdir(path.join(root, 'assets/books'))).toEqual(['9788901234567.jpg']);
  });

  it('그림이 아니면 거절한다', async () => {
    const root = await workspace();
    const routes = createBookRoutes(
      new ServerFileStore(root),
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );

    const response = await routes.request('/api/books/cover?key=x', {
      method: 'POST',
      headers: { 'content-type': 'application/pdf' },
      body: new Uint8Array([1, 2, 3]),
    });

    expect(response.status).toBe(400);
  });

  it('이름 없이 올리지 못한다', async () => {
    const root = await workspace();
    const routes = createBookRoutes(
      new ServerFileStore(root),
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );

    const response = await routes.request('/api/books/cover', {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: new Uint8Array([1, 2, 3]),
    });

    expect(response.status).toBe(400);
  });
});

describe('/api/books', () => {
  it('ISBN 조회 결과를 그대로 돌려주고, 못 찾는 것은 오류가 아니다', async () => {
    const root = await workspace();
    const found = createBookRoutes(
      new ServerFileStore(root),
      provider({ title: '찾은 책', authors: ['저자'], source: 'Open Library' }),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );
    const missing = createBookRoutes(
      new ServerFileStore(root),
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );

    const hit = await (await found.request('/api/books/lookup?isbn=9788901234567')).json();
    const miss = await missing.request('/api/books/lookup?isbn=978-89-0123-456-7');

    expect(hit).toMatchObject({ found: true, metadata: { title: '찾은 책' } });
    expect(miss.status).toBe(200);
    expect(await miss.json()).toMatchObject({ found: false });
  });

  it('ISBN 모양이 아니면 조회하지 않는다', async () => {
    const root = await workspace();
    const routes = createBookRoutes(
      new ServerFileStore(root),
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );

    expect((await routes.request('/api/books/lookup?isbn=없음')).status).toBe(400);
  });

  it('등록하면 책 문서가 생기고 본문은 비공개 메모가 된다', async () => {
    const root = await workspace();
    const routes = createBookRoutes(
      new ServerFileStore(root),
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );

    const response = await routes.request('/api/books', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '니체의 초월자',
        authors: ['프리드리히 니체'],
        status: 'reading',
        format: 'ebook',
        source: 'library',
        startedAt: '2026-08-06',
        isbn13: '978-89-0123-456-7',
        notes: '밑줄 친 문장.',
      }),
    });

    expect(response.status).toBe(201);
    const written = await readFile(path.join(root, 'books', '9788901234567.md'), 'utf8');
    expect(written).toContain('kind: book');
    expect(written).toContain('status: reading');
    expect(written).toContain('밑줄 친 문장.');
    // 읽은 목록은 공개가 기본이고 감추는 것이 예외다.
    expect(written).toContain('visible: true');
  });

  it('표지는 등록하는 순간 받아서 작업 공간에 둔다', async () => {
    const root = await workspace();
    const fetchImpl = vi.fn(async () => coverResponse(new Uint8Array([1, 2, 3, 4])));
    const routes = createBookRoutes(
      new ServerFileStore(root),
      provider(null),
      new BookAssetStore({ workspaceRoot: root, fetch: fetchImpl as never }),
      options,
    );

    const response = await routes.request('/api/books', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '표지 있는 책',
        authors: ['저자'],
        status: 'finished',
        format: 'paper',
        source: 'purchase',
        isbn13: '9788901234567',
        coverUrl: 'https://covers.example/l.jpg',
        coverSource: 'Open Library',
      }),
    });

    expect(response.status).toBe(201);
    expect(await readdir(path.join(root, 'assets/books'))).toEqual(['9788901234567.jpg']);
    const written = await readFile(path.join(root, 'books', '9788901234567.md'), 'utf8');
    expect(written).toContain('cover: assets/books/9788901234567.jpg');
  });

  it('표지를 받지 못해도 등록은 계속된다', async () => {
    const root = await workspace();
    const routes = createBookRoutes(
      new ServerFileStore(root),
      provider(null),
      new BookAssetStore({
        workspaceRoot: root,
        fetch: vi.fn(async () => {
          throw new Error('cover host down');
        }) as never,
      }),
      options,
    );

    const response = await routes.request('/api/books', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '표지 실패',
        authors: ['저자'],
        status: 'want',
        format: 'paper',
        source: 'purchase',
        coverUrl: 'https://covers.example/x.jpg',
      }),
    });

    expect(response.status).toBe(201);
    expect(await readFile(path.join(root, 'books', '표지-실패.md'), 'utf8')).toContain(
      'kind: book',
    );
  });

  it('올려 둔 표지가 있으면 그것을 쓰고 남의 서버를 부르지 않는다', async () => {
    const root = await workspace();
    const fetchImpl = vi.fn();
    const routes = createBookRoutes(
      new ServerFileStore(root),
      provider(null),
      new BookAssetStore({ workspaceRoot: root, fetch: fetchImpl as never }),
      options,
    );

    const response = await routes.request('/api/books', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '직접 올린 표지',
        authors: ['저자'],
        status: 'reading',
        format: 'paper',
        source: 'purchase',
        cover: 'assets/books/직접-올린-표지.jpg',
        coverUrl: 'https://covers.example/other.jpg',
      }),
    });

    expect(response.status).toBe(201);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await readFile(path.join(root, 'books', '직접-올린-표지.md'), 'utf8')).toContain(
      'cover: assets/books/직접-올린-표지.jpg',
    );
  });

  it('작업 공간 밖을 가리키는 표지 경로는 받지 않는다', async () => {
    const root = await workspace();
    const routes = createBookRoutes(
      new ServerFileStore(root),
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );

    const response = await routes.request('/api/books', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '수상한 표지',
        authors: ['저자'],
        status: 'reading',
        format: 'paper',
        source: 'purchase',
        cover: 'assets/books/../../../etc/passwd',
      }),
    });

    expect(response.status).toBe(400);
  });

  it('같은 책을 두 번 등록하지 않는다', async () => {
    const root = await workspace();
    await mkdir(path.join(root, 'books'), { recursive: true });
    const routes = createBookRoutes(
      new ServerFileStore(root),
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );
    const body = JSON.stringify({
      title: '중복',
      authors: ['저자'],
      status: 'reading',
      format: 'paper',
      source: 'purchase',
      isbn13: '9788901234567',
    });
    const request = () =>
      routes.request('/api/books', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });

    expect((await request()).status).toBe(201);
    expect((await request()).status).toBe(409);
  });
});

describe('POST /api/books/:id/excerpts', () => {
  async function withBook(): Promise<{
    routes: ReturnType<typeof createBookRoutes>;
    root: string;
    id: string;
  }> {
    const root = await workspace();
    const store = new ServerFileStore(root);
    const routes = createBookRoutes(
      store,
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );
    await routes.request('/api/books', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '사피엔스',
        authors: ['유발 하라리'],
        status: 'reading',
        format: 'ebook',
        source: 'library',
        isbn13: '9788934972464',
        notes: '1부는 흥미로운데 3부는 늘어진다.',
      }),
    });
    const { documents } = await store.listDocuments();
    const book = documents.find((entry) => entry.kind === 'book');
    return { routes, root, id: encodeDocumentId(book?.relativePath ?? '') };
  }

  const add = (routes: ReturnType<typeof createBookRoutes>, id: string, body: unknown) =>
    routes.request(`/api/books/${id}/excerpts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('구절과 그에 딸린 메모를 더해도 독서 노트(본문)는 그대로다', async () => {
    const { routes, root, id } = await withBook();

    const response = await add(routes, id, {
      page: 42,
      text: '인지혁명이 가능했던 것은\n허구를 믿는 능력 때문이다',
      memo: '여기서 말하는 허구는 제도 전반',
    });

    expect(response.status).toBe(201);
    const document = parseDocument(
      await readFile(path.join(root, 'books', '9788934972464.md'), 'utf8'),
    );
    expect(document.excerpts).toEqual([
      {
        id: expect.any(String),
        page: 42,
        text: '인지혁명이 가능했던 것은\n허구를 믿는 능력 때문이다',
        memo: '여기서 말하는 허구는 제도 전반',
        addedAt: '2026-08-19',
      },
    ]);
    expect(document.content.trim()).toBe('1부는 흥미로운데 3부는 늘어진다.');
  });

  it('구절을 더할수록 쌓인다 — 앞의 것을 덮지 않는다', async () => {
    const { routes, root, id } = await withBook();

    await add(routes, id, { page: 42, text: '첫 번째' });
    await add(routes, id, { text: '두 번째' });

    const document = parseDocument(
      await readFile(path.join(root, 'books', '9788934972464.md'), 'utf8'),
    );
    expect(document.excerpts?.map((excerpt) => excerpt.text)).toEqual(['첫 번째', '두 번째']);
    // 페이지를 모르는 앱도 있다. 없이도 받는다.
    expect(document.excerpts?.[1]).not.toHaveProperty('page');
  });

  it('옮긴 문장이 없으면 구절이 아니다', async () => {
    const { routes, id } = await withBook();

    expect((await add(routes, id, { page: 42, memo: '내 생각만' })).status).toBe(400);
    expect((await add(routes, id, { text: '' })).status).toBe(400);
  });

  it('책이 아닌 문서에는 구절을 붙이지 않는다', async () => {
    const root = await workspace();
    const store = new ServerFileStore(root);
    await mkdir(path.join(root, 'notes'), { recursive: true });
    await store.importDocument({
      relativePath: 'notes/plain.md',
      source:
        '---\ntitle: 그냥 메모\nkind: note\ncreatedAt: 2026-08-19\nupdatedAt: 2026-08-19\n---\n본문\n',
      overwrite: false,
    });
    const routes = createBookRoutes(
      store,
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );

    const response = await add(routes, encodeDocumentId('notes/plain.md'), { text: '문장' });

    expect(response.status).toBe(404);
  });
});

describe('PUT /api/books/:id — 화면에서 고치기', () => {
  async function seeded(): Promise<{
    routes: ReturnType<typeof createBookRoutes>;
    root: string;
    id: string;
    read: () => Promise<ReturnType<typeof parseDocument>>;
  }> {
    const root = await workspace();
    const store = new ServerFileStore(root);
    const routes = createBookRoutes(
      store,
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );
    await routes.request('/api/books', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '사피엔스',
        authors: ['유발 하라리'],
        status: 'reading',
        format: 'ebook',
        source: 'library',
        isbn13: '9788934972464',
        notes: '읽는 중 메모.',
      }),
    });
    const file = path.join(root, 'books', '9788934972464.md');
    // 사람이 손으로 넣어 둔, 이 앱이 모르는 필드. 화면을 거쳤다고 사라지면 안 된다.
    await writeFile(
      file,
      (await readFile(file, 'utf8')).replace(
        'visible: true',
        'visible: true\nmyOwnField: 지우지 마',
      ),
    );
    return {
      routes,
      root,
      id: encodeDocumentId('books/9788934972464.md'),
      read: async () => parseDocument(await readFile(file, 'utf8')),
    };
  }

  const put = (routes: ReturnType<typeof createBookRoutes>, id: string, body: unknown) =>
    routes.request(`/api/books/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  const complete = {
    title: '사피엔스',
    authors: ['유발 하라리'],
    status: 'finished',
    format: 'ebook',
    source: 'library',
    visible: true,
    content: '다 읽었다.\n',
  };

  it('상태와 메모를 함께 고친다', async () => {
    const { routes, id, read } = await seeded();

    const response = await put(routes, id, { ...complete, rating: 5, finishedAt: '2026-08-20' });

    expect(response.status).toBe(200);
    const document = await read();
    expect(document.status).toBe('finished');
    expect(document.rating).toBe(5);
    expect(document.finishedAt).toBe('2026-08-20');
    expect(document.content.trim()).toBe('다 읽었다.');
    expect(document.updatedAt).toBe('2026-08-19');
  });

  it('안 보낸 칸은 비운 것이다 — 별점을 지울 수 있어야 한다', async () => {
    const { routes, id, read } = await seeded();

    await put(routes, id, { ...complete, rating: 4 });
    await put(routes, id, complete);

    expect(await read()).not.toHaveProperty('rating');
  });

  it('구절과 표지, 모르는 필드는 화면이 건드리지 않는다', async () => {
    const { routes, id, read } = await seeded();
    await routes.request(`/api/books/${id}/excerpts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page: 42, text: '옮긴 문장' }),
    });

    await put(routes, id, complete);

    const document = await read();
    expect(document.excerpts?.[0]?.text).toBe('옮긴 문장');
    expect(document.extra['myOwnField']).toBe('지우지 마');
  });

  it('제목을 고쳐도 파일은 그 자리에 있다', async () => {
    const { routes, root, id, read } = await seeded();

    await put(routes, id, { ...complete, title: '사피엔스 (개정판)' });

    expect((await read()).title).toBe('사피엔스 (개정판)');
    expect(await readdir(path.join(root, 'books'))).toEqual(['9788934972464.md']);
  });

  it('저자 없는 책으로 만들지 못한다', async () => {
    const { routes, id } = await seeded();

    expect((await put(routes, id, { ...complete, authors: [] })).status).toBe(400);
    expect((await put(routes, id, { ...complete, status: 'skimmed' })).status).toBe(400);
  });
});

describe('구절 고치기와 지우기', () => {
  async function withExcerpts(): Promise<{
    routes: ReturnType<typeof createBookRoutes>;
    id: string;
    read: () => Promise<ReturnType<typeof parseDocument>>;
  }> {
    const root = await workspace();
    const store = new ServerFileStore(root);
    const routes = createBookRoutes(
      store,
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );
    await routes.request('/api/books', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '사피엔스',
        authors: ['유발 하라리'],
        status: 'reading',
        format: 'ebook',
        source: 'library',
        isbn13: '9788934972464',
      }),
    });
    const id = encodeDocumentId('books/9788934972464.md');
    for (const text of ['첫 번째', '두 번째']) {
      await routes.request(`/api/books/${id}/excerpts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    }
    return {
      routes,
      id,
      read: async () =>
        parseDocument(await readFile(path.join(root, 'books', '9788934972464.md'), 'utf8')),
    };
  }

  it('NOR-196 AC-9: 구절 수정 후 id 와 public 이 유지된다', async () => {
    const { routes, id, read } = await withExcerpts();
    const first = (await read()).excerpts?.[0];
    expect(first?.id).toBeDefined();
    const set = await routes.request(`/api/books/${id}/excerpts/0`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '공개', public: true }),
    });
    expect(set.status).toBe(200);
    await routes.request(`/api/books/${id}/excerpts/0`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '수정' }),
    });
    expect((await read()).excerpts?.[0]).toMatchObject({
      id: first?.id,
      public: true,
      text: '수정',
    });
  });

  it('오타를 고쳐도 옮겨 적은 날은 그대로다', async () => {
    const { routes, id, read } = await withExcerpts();

    const response = await routes.request(`/api/books/${id}/excerpts/0`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '첫 번째 (고침)', page: 12 }),
    });

    expect(response.status).toBe(200);
    expect((await read()).excerpts?.[0]).toEqual({
      id: expect.any(String),
      text: '첫 번째 (고침)',
      page: 12,
      addedAt: '2026-08-19',
    });
  });

  it('구절 하나만 지우고 나머지는 남긴다', async () => {
    const { routes, id, read } = await withExcerpts();

    const response = await routes.request(`/api/books/${id}/excerpts/0`, { method: 'DELETE' });

    expect(response.status).toBe(200);
    expect((await read()).excerpts?.map((excerpt) => excerpt.text)).toEqual(['두 번째']);
  });

  it('마지막 구절을 지우면 키 자체가 사라진다', async () => {
    const { routes, id, read } = await withExcerpts();

    await routes.request(`/api/books/${id}/excerpts/1`, { method: 'DELETE' });
    await routes.request(`/api/books/${id}/excerpts/0`, { method: 'DELETE' });

    expect(await read()).not.toHaveProperty('excerpts');
  });

  it('없는 구절은 고치지도 지우지도 못한다', async () => {
    const { routes, id } = await withExcerpts();

    expect((await routes.request(`/api/books/${id}/excerpts/9`, { method: 'DELETE' })).status).toBe(
      404,
    );
    expect(
      (
        await routes.request(`/api/books/${id}/excerpts/9`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: '없는 것' }),
        })
      ).status,
    ).toBe(404);
  });
});

describe('독서 메모는 구절과 다른 목록이다', () => {
  it('옮길 문장 없이 남기고, 구절 목록을 건드리지 않는다', async () => {
    const root = await workspace();
    const store = new ServerFileStore(root);
    const routes = createBookRoutes(
      store,
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );
    await routes.request('/api/books', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '사피엔스',
        authors: ['유발 하라리'],
        status: 'reading',
        format: 'ebook',
        source: 'library',
        isbn13: '9788934972464',
      }),
    });
    const id = encodeDocumentId('books/9788934972464.md');
    await routes.request(`/api/books/${id}/excerpts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '옮긴 문장' }),
    });

    const response = await routes.request(`/api/books/${id}/memos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page: 200, text: '3부부터 늘어진다' }),
    });

    expect(response.status).toBe(201);
    const document = parseDocument(
      await readFile(path.join(root, 'books', '9788934972464.md'), 'utf8'),
    );
    expect(document.memos).toEqual([
      { page: 200, text: '3부부터 늘어진다', addedAt: '2026-08-19' },
    ]);
    expect(document.excerpts?.map((excerpt) => excerpt.text)).toEqual(['옮긴 문장']);
  });

  it('없는 목록 이름으로는 아무것도 못 남긴다', async () => {
    const root = await workspace();
    const store = new ServerFileStore(root);
    const routes = createBookRoutes(
      store,
      provider(null),
      new BookAssetStore({ workspaceRoot: root }),
      options,
    );
    await routes.request('/api/books', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '사피엔스',
        authors: ['유발 하라리'],
        status: 'reading',
        format: 'ebook',
        source: 'library',
        isbn13: '9788934972464',
      }),
    });

    const response = await routes.request(
      `/api/books/${encodeDocumentId('books/9788934972464.md')}/whatever`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: '아무 말' }),
      },
    );

    expect(response.status).toBe(404);
  });
});
