import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { BookAssetStore } from './bookAssets.js';

async function store(): Promise<{ root: string; assets: BookAssetStore }> {
  const root = await mkdtemp(path.join(tmpdir(), 'workbench-cover-'));
  return { root, assets: new BookAssetStore({ workspaceRoot: root }) };
}

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe('BookAssetStore.saveCoverBytes', () => {
  it('올린 표지를 작업 공간에 둔다', async () => {
    const { root, assets } = await store();

    const relativePath = await assets.saveCoverBytes('9788901234567', jpeg, 'image/jpeg');

    expect(relativePath).toBe('assets/books/9788901234567.jpg');
    expect(await readFile(path.join(root, 'assets/books/9788901234567.jpg'))).toEqual(
      Buffer.from(jpeg),
    );
  });

  it('그림이 아닌 것은 받지 않는다', async () => {
    const { assets } = await store();

    expect(await assets.saveCoverBytes('key', jpeg, 'application/pdf')).toBeNull();
    expect(await assets.saveCoverBytes('key', jpeg, 'text/html; charset=utf-8')).toBeNull();
  });

  it('빈 파일과 너무 큰 파일을 거른다', async () => {
    const { assets } = await store();

    expect(await assets.saveCoverBytes('key', new Uint8Array(0), 'image/png')).toBeNull();
    expect(
      await assets.saveCoverBytes('key', new Uint8Array(5 * 1024 * 1024 + 1), 'image/png'),
    ).toBeNull();
  });

  it('content-type 에 붙은 charset 을 무시한다', async () => {
    const { assets } = await store();

    expect(await assets.saveCoverBytes('key', jpeg, 'image/png; charset=binary')).toBe(
      'assets/books/key.png',
    );
  });

  /** ASCII 만 남기면 국내서 열쇠가 전부 빈 문자열이 되어 서로를 덮어썼다. */
  it('한글 제목을 열쇠로 써도 책마다 다른 파일이 된다', async () => {
    const { root, assets } = await store();

    await assets.saveCoverBytes('토지', jpeg, 'image/jpeg');
    await assets.saveCoverBytes('데미안', jpeg, 'image/jpeg');

    expect((await readdir(path.join(root, 'assets/books'))).sort()).toEqual([
      '데미안.jpg',
      '토지.jpg',
    ]);
  });

  it('띄어쓰기는 책 문서 이름과 같은 모양으로 이어 붙인다', async () => {
    const { assets } = await store();

    expect(await assets.saveCoverBytes('표지 직접 올린 책', jpeg, 'image/jpeg')).toBe(
      'assets/books/표지-직접-올린-책.jpg',
    );
  });

  it('경로를 벗어나려는 열쇠는 걷어낸다', async () => {
    const { assets } = await store();

    expect(await assets.saveCoverBytes('../../etc/passwd', jpeg, 'image/jpeg')).toBe(
      'assets/books/etcpasswd.jpg',
    );
  });
});

describe('BookAssetStore.saveCover', () => {
  it('https 가 아닌 주소는 받지 않는다', async () => {
    const { assets } = await store();

    expect(await assets.saveCover('key', 'http://covers.example/a.jpg')).toBeNull();
    expect(await assets.saveCover('key', 'file:///etc/passwd')).toBeNull();
  });

  it('받아 온 표지도 같은 검사를 거친다', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-cover-'));
    const assets = new BookAssetStore({
      workspaceRoot: root,
      fetch: (async () =>
        ({
          ok: true,
          headers: { get: () => 'application/pdf' },
          arrayBuffer: async () => jpeg.buffer,
        }) as unknown as Response) as typeof globalThis.fetch,
    });

    expect(await assets.saveCover('key', 'https://covers.example/a.pdf')).toBeNull();
  });
});
