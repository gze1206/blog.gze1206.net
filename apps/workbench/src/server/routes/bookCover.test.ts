import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { parseDocument } from '../../core/document/document.js';
import { BookAssetStore } from '../adapters/bookAssets.js';
import { ServerFileStore } from '../adapters/fileStore.js';
import { encodeDocumentId } from '../documentIds.js';
import { createBookRoutes } from './books.js';

const options = { today: () => '2026-11-15', slugify: (t: string) => t.replace(/\s+/gu, '-') };

function coverResponse(bytes: Uint8Array): Response {
  return {
    ok: true,
    headers: { get: () => 'image/jpeg' },
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Response;
}

async function seeded(fetchImpl?: unknown) {
  const root = await mkdtemp(path.join(tmpdir(), 'workbench-cover-'));
  const routes = createBookRoutes(
    new ServerFileStore(root),
    { lookup: async () => null },
    new BookAssetStore({
      workspaceRoot: root,
      ...(fetchImpl ? { fetch: fetchImpl as never } : {}),
    }),
    options,
  );
  await routes.request('/api/books', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: '표지 없는 책',
      authors: ['저자'],
      translators: ['옮긴이'],
      status: 'finished',
      format: 'paper',
      source: 'purchase',
      isbn13: '9788901234567',
      notes: '본문 메모.',
    }),
  });
  const file = path.join(root, 'books', '9788901234567.md');
  return {
    root,
    routes,
    id: encodeDocumentId('books/9788901234567.md'),
    read: async () => parseDocument(await readFile(file, 'utf8')),
    put: (body: unknown) =>
      routes.request(`/api/books/${encodeDocumentId('books/9788901234567.md')}/cover`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
  };
}

describe('PUT /api/books/:id/cover', () => {
  it('NOR-204 AC-1: 올려 둔 표지로 바꾸고 다른 필드와 본문은 그대로 둔다', async () => {
    const book = await seeded();
    const before = await book.read();
    const response = await book.put({ cover: 'assets/books/9788901234567.png' });
    expect(response.status).toBe(200);
    const after = await book.read();
    expect(after).toHaveProperty('cover', 'assets/books/9788901234567.png');
    expect(after).toHaveProperty('translators', ['옮긴이']);
    expect(after.content).toBe(before.content);
  });

  it('NOR-204 AC-1: 작업 공간 밖을 가리키는 경로는 400 이다', async () => {
    const book = await seeded();
    expect((await book.put({ cover: '../../etc/passwd' })).status).toBe(400);
    expect(await book.read()).not.toHaveProperty('cover');
  });

  it('NOR-204 AC-2: 조회한 표지 주소를 받아 저장하고 출처를 남긴다', async () => {
    const fetchImpl = vi.fn(async () => coverResponse(new Uint8Array([1, 2, 3])));
    const book = await seeded(fetchImpl);
    const response = await book.put({
      coverUrl: 'https://covers.example/l.jpg',
      coverSource: 'Open Library',
    });
    expect(response.status).toBe(200);
    expect(await readdir(path.join(book.root, 'assets/books'))).toEqual(['9788901234567.jpg']);
    const after = await book.read();
    expect(after).toHaveProperty('cover', 'assets/books/9788901234567.jpg');
    expect(after).toHaveProperty('coverSource', 'Open Library');
  });

  it('NOR-204 AC-2: 표지를 받지 못하면 502 이고 문서는 그대로다', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false }) as Response);
    const book = await seeded(fetchImpl);
    const response = await book.put({ coverUrl: 'https://covers.example/missing.jpg' });
    expect(response.status).toBe(502);
    expect(await book.read()).not.toHaveProperty('cover');
  });

  it('NOR-204 AC-3: 표지를 지운다', async () => {
    const book = await seeded();
    await book.put({ cover: 'assets/books/9788901234567.png' });
    const response = await book.put({ remove: true });
    expect(response.status).toBe(200);
    const after = await book.read();
    expect(after).not.toHaveProperty('cover');
    expect(after).not.toHaveProperty('coverSource');
  });
});
