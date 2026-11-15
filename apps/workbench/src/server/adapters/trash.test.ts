import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ServerFileStore } from './fileStore.js';

const doc = (title: string) => `---
title: ${title}
kind: private-post
createdAt: 2026-11-15
updatedAt: 2026-11-15
---
# ${title}
`;

async function seeded() {
  const root = await mkdtemp(path.join(tmpdir(), 'workbench-trash-'));
  await mkdir(path.join(root, 'drafts'));
  await writeFile(path.join(root, 'drafts', 'a.md'), doc('지울 글'));
  await writeFile(path.join(root, 'drafts', 'b.md'), doc('남길 글'));
  return { root, store: new ServerFileStore(root) };
}

describe('휴지통', () => {
  it('NOR-205 AC-1: 지운 문서는 목록에서 빠지고 휴지통에 원래 경로·제목과 함께 나온다', async () => {
    const { store } = await seeded();
    expect(store).toHaveProperty('trashDocument');
    await store.trashDocument('drafts/a.md');
    const list = await store.listDocuments();
    expect(list.documents.map((d) => d.relativePath)).toEqual(['drafts/b.md']);
    const trash = await store.listTrash();
    expect(trash).toHaveLength(1);
    expect(trash[0]).toMatchObject({ relativePath: 'drafts/a.md', title: '지울 글' });
    expect(trash[0]?.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  });

  it('NOR-205 AC-2: 복원하면 원래 자리로 돌아온다', async () => {
    const { root, store } = await seeded();
    expect(store).toHaveProperty('trashDocument');
    await store.trashDocument('drafts/a.md');
    const [entry] = await store.listTrash();
    await store.restoreTrash(entry?.id ?? '');
    expect(await readFile(path.join(root, 'drafts', 'a.md'), 'utf8')).toContain('지울 글');
    expect(await store.listTrash()).toEqual([]);
  });

  it('NOR-205 AC-2: 원래 자리에 문서가 있으면 복원하지 않고 둘 다 그대로 둔다', async () => {
    const { root, store } = await seeded();
    expect(store).toHaveProperty('trashDocument');
    await store.trashDocument('drafts/a.md');
    await writeFile(path.join(root, 'drafts', 'a.md'), doc('새로 쓴 글'));
    const [entry] = await store.listTrash();
    await expect(store.restoreTrash(entry?.id ?? '')).rejects.toThrow();
    expect(await readFile(path.join(root, 'drafts', 'a.md'), 'utf8')).toContain('새로 쓴 글');
    expect(await store.listTrash()).toHaveLength(1);
  });

  it('NOR-205 AC-3: 영구 삭제하고, 휴지통 밖을 가리키는 id 는 거절한다', async () => {
    const { root, store } = await seeded();
    expect(store).toHaveProperty('trashDocument');
    await store.trashDocument('drafts/a.md');
    const [entry] = await store.listTrash();
    await expect(store.purgeTrash('../../drafts/b.md')).rejects.toThrow();
    await store.purgeTrash(entry?.id ?? '');
    expect(await store.listTrash()).toEqual([]);
    expect(await readdir(path.join(root, 'drafts'))).toEqual(['b.md']);
  });
});
