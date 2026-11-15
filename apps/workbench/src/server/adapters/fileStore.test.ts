import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ServerFileStore } from './fileStore.js';

const templateSource = `---
title: 비공개 글
kind: private-post
defaultPath: drafts
publicEligible: false
customField: keep-me
createdAt: 2000-01-01
---
# {{date}} — {{id}}

{{period}} / {{isoDate}}
`;

describe('ServerFileStore', () => {
  it('lists templates and creates, reads, and atomically updates a document', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-store-'));
    await mkdir(path.join(root, 'templates'));
    await writeFile(path.join(root, 'templates', 'private-post.md'), templateSource);
    const store = new ServerFileStore(root);

    await expect(store.listTemplates()).resolves.toMatchObject([
      { id: 'private-post', title: '비공개 글', kind: 'private-post' },
    ]);

    const created = await store.createFromTemplate({
      templateId: 'private-post',
      title: 'My Draft',
      tokens: {
        date: '2026-08-12',
        isoDate: '2026-08-12T12:00:00.000Z',
        period: '2026-W33',
        id: 'doc-01',
      },
    });

    expect(created.relativePath).toBe('drafts/my-draft.md');
    expect(created.source).toContain('customField: keep-me');
    expect(created.source).toContain('createdAt: 2026-08-12');
    expect(created.source).not.toContain('createdAt: 2000-01-01');
    expect(created.source).toContain('# 2026-08-12 — doc-01');
    await expect(store.readDocument(created.relativePath)).resolves.toEqual(created);

    const updated = created.source.replace('My Draft', 'Updated Draft');
    await store.writeDocument(created.relativePath, updated);
    expect(await readFile(path.join(root, created.relativePath), 'utf8')).toBe(updated);
  });

  it('never allows store operations to escape the workspace', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-store-'));
    const store = new ServerFileStore(root);

    await expect(store.readDocument('../outside.md')).rejects.toThrow('workspace-relative path');
    await expect(store.writeDocument('/tmp/outside.md', templateSource)).rejects.toThrow(
      'workspace-relative path',
    );
  });

  it('never reads or writes forged non-document paths inside the workspace', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-store-'));
    await mkdir(path.join(root, '.git'));
    await mkdir(path.join(root, 'templates'));
    const gitIndex = path.join(root, '.git', 'index');
    const template = path.join(root, 'templates', 'capture.md');
    await writeFile(gitIndex, 'git-index-source');
    await writeFile(template, templateSource);
    const store = new ServerFileStore(root);

    for (const relativePath of ['.git/index', 'templates/capture.md']) {
      await expect(store.readDocument(relativePath)).rejects.toThrow('document path');
      await expect(store.writeDocument(relativePath, templateSource)).rejects.toThrow(
        'document path',
      );
    }

    await expect(readFile(gitIndex, 'utf8')).resolves.toBe('git-index-source');
    await expect(readFile(template, 'utf8')).resolves.toBe(templateSource);
  });

  it('persists and returns canonical document source while preserving unknown fields', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-store-'));
    await mkdir(path.join(root, 'drafts'));
    const target = path.join(root, 'drafts', 'canonical.md');
    await writeFile(target, templateSource);
    const store = new ServerFileStore(root);
    const noncanonical = `---
customField: keep-me
tags:
  - alpha
  - beta
updatedAt: 2026-08-12
kind: private-post
createdAt: 2026-08-10
title: Canonical
---
Body
`;
    const canonical = `---
title: Canonical
kind: private-post
createdAt: 2026-08-10
updatedAt: 2026-08-12
tags: ['alpha', 'beta']
customField: keep-me
---
Body
`;

    const updated = await store.writeDocument('drafts/canonical.md', noncanonical);

    expect(updated.source).toBe(canonical);
    await expect(readFile(target, 'utf8')).resolves.toBe(canonical);
    expect(updated.document.extra).toEqual({ customField: 'keep-me' });
  });

  it('lists only supported document directories and never scans unrelated Markdown', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-store-'));
    await mkdir(path.join(root, 'notes'));
    await mkdir(path.join(root, 'notes', 'assets'));
    await mkdir(path.join(root, 'misc'));
    await mkdir(path.join(root, '.git', 'hidden'), { recursive: true });
    await writeFile(path.join(root, 'README.md'), '# unrelated');
    await writeFile(path.join(root, 'misc', 'broken.md'), 'not frontmatter');
    await writeFile(path.join(root, '.git', 'hidden', 'broken.md'), 'not frontmatter');
    await writeFile(
      path.join(root, 'notes', 'valid.md'),
      `---\ntitle: Valid\nkind: note\ncreatedAt: 2026-08-12\nupdatedAt: 2026-08-12\n---\nBody\n`,
    );
    await writeFile(
      path.join(root, 'notes', 'assets', 'secret.md'),
      `---\ntitle: Secret\nkind: note\ncreatedAt: 2026-08-12\nupdatedAt: 2026-08-12\n---\nBody\n`,
    );
    const store = new ServerFileStore(root);

    await expect(store.readDocument('notes/assets/secret.md')).rejects.toThrow('document path');
    await expect(store.listDocuments()).resolves.toEqual({
      documents: [
        {
          relativePath: 'notes/valid.md',
          label: 'valid',
          title: 'Valid',
          kind: 'note',
          updatedAt: '2026-08-12',
        },
      ],
      problems: [],
    });
  });
});

describe('목록에 실리는 책 정보', () => {
  it('표지 경로를 함께 실어 보낸다 — 목록이 파일을 다시 열지 않도록', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-store-'));
    await mkdir(path.join(root, 'books'), { recursive: true });
    await writeFile(
      path.join(root, 'books', 'with-cover.md'),
      `---\ntitle: 표지 있는 책\nkind: book\ncreatedAt: 2026-08-20\nupdatedAt: 2026-08-20\nauthors: ['저자']\nstatus: reading\ncover: assets/books/with-cover.jpg\n---\n메모\n`,
    );
    await writeFile(
      path.join(root, 'books', 'no-cover.md'),
      `---\ntitle: 표지 없는 책\nkind: book\ncreatedAt: 2026-08-20\nupdatedAt: 2026-08-20\nauthors: ['저자']\nstatus: want\n---\n메모\n`,
    );
    const store = new ServerFileStore(root);

    const { documents } = await store.listDocuments();

    const covers = new Map(documents.map((entry) => [entry.relativePath, entry.cover]));
    expect(covers.get('books/with-cover.md')).toBe('assets/books/with-cover.jpg');
    // 표지가 없는 책은 키 자체가 없어야 한다 — 빈 문자열을 주면 화면이 깨진 그림을 그린다.
    expect(covers.get('books/no-cover.md')).toBeUndefined();
    expect(
      documents.find((entry) => entry.relativePath === 'books/no-cover.md'),
    ).not.toHaveProperty('cover');
  });
});

describe('깨진 문서가 있어도 목록을 만든다', () => {
  it('읽을 수 있는 것은 읽고, 실패한 파일은 이유와 함께 따로 알린다', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-store-'));
    await mkdir(path.join(root, 'notes'), { recursive: true });
    await writeFile(
      path.join(root, 'notes', 'ok.md'),
      `---\ntitle: 정상\nkind: note\ncreatedAt: 2026-08-12\nupdatedAt: 2026-08-12\n---\n본문\n`,
    );
    // 사람이 손으로 고치다 `kind` 를 빠뜨린 파일. 이 하나가 목록 전체를 막아서는 안 된다.
    await writeFile(path.join(root, 'notes', 'broken.md'), `---\ntitle: 깨진 것\n---\n본문\n`);
    const store = new ServerFileStore(root);

    const result = await store.listDocuments();

    expect(result.documents.map((entry) => entry.relativePath)).toEqual(['notes/ok.md']);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]?.relativePath).toBe('notes/broken.md');
    // 어느 파일이 왜 안 되는지 알아야 고칠 수 있다.
    expect(result.problems[0]?.message).toMatch(/kind/);
    // 경로는 따로 들고 있으므로 메시지에 또 넣지 않는다.
    expect(result.problems[0]?.message).not.toContain('notes/broken.md');
  });

  it('깨진 문서를 직접 열면 오류에 파일 경로가 들어 있다', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-store-'));
    await mkdir(path.join(root, 'notes'), { recursive: true });
    await writeFile(path.join(root, 'notes', 'broken.md'), `---\ntitle: 깨진 것\n---\n본문\n`);
    const store = new ServerFileStore(root);

    await expect(store.readDocument('notes/broken.md')).rejects.toThrow('notes/broken.md');
  });
});
