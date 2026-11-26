import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ServerFileStore } from '../adapters/fileStore.js';
import { createApp } from '../app.js';
import { encodeDocumentId } from '../documentIds.js';

describe('/api/documents', () => {
  it('uses opaque document ids and rejects forged path input at the HTTP boundary', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-api-'));
    await mkdir(path.join(root, 'templates'));
    await writeFile(
      path.join(root, 'templates', 'capture.md'),
      `---\ntitle: 빠른 메모\nkind: capture\ndefaultPath: inbox\npublicEligible: false\n---\n# {{date}}\n`,
    );
    const app = createApp(new ServerFileStore(root));

    const createResponse = await app.request('/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ templateId: 'capture', title: 'Quick note' }),
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as Record<string, unknown>;
    expect(created).toMatchObject({ title: 'Quick note', kind: 'capture' });
    expect(created).toHaveProperty('id');
    expect(created).not.toHaveProperty('relativePath');

    const listResponse = await app.request('/api/documents');
    const listed = (await listResponse.json()) as {
      documents: Array<Record<string, unknown>>;
      problems: Array<Record<string, unknown>>;
    };
    expect(listed.documents).toHaveLength(1);
    expect(listed.documents[0]).not.toHaveProperty('relativePath');
    expect(listed.problems).toEqual([]);

    const forged = await app.request('/api/documents/not-valid!');
    expect(forged.status).toBe(400);

    const missingButValid = await app.request(
      `/api/documents/${encodeDocumentId('drafts/not-created.md')}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: created.source }),
      },
    );
    expect(missingButValid.status).toBe(404);
  });

  it('cannot read or overwrite git metadata and templates with forged ids', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-api-'));
    await mkdir(path.join(root, '.git'));
    await mkdir(path.join(root, 'templates'));
    const gitIndex = path.join(root, '.git', 'index');
    const template = path.join(root, 'templates', 'capture.md');
    const templateSource = `---\ntitle: 빠른 메모\nkind: capture\ndefaultPath: inbox\npublicEligible: false\n---\n# {{date}}\n`;
    await writeFile(gitIndex, 'git-index-source');
    await writeFile(template, templateSource);
    const app = createApp(new ServerFileStore(root));

    for (const relativePath of ['.git/index', 'templates/capture.md']) {
      const forgedId = encodeDocumentId(relativePath);
      expect(Buffer.from(forgedId, 'base64url').toString('utf8')).not.toBe(relativePath);
      expect((await app.request(`/api/documents/${forgedId}`)).status).toBe(404);
      expect(
        (
          await app.request(`/api/documents/${forgedId}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ source: templateSource }),
          })
        ).status,
      ).toBe(404);
    }

    await expect(readFile(gitIndex, 'utf8')).resolves.toBe('git-index-source');
    await expect(readFile(template, 'utf8')).resolves.toBe(templateSource);
  });

  it('returns 400 for missing or invalid review periods and accepts kind-specific periods', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-api-'));
    await mkdir(path.join(root, 'templates'));
    await writeFile(
      path.join(root, 'templates', 'weekly-review.md'),
      `---\ntitle: 주간 회고\nkind: weekly-review\ndefaultPath: reviews/weekly\npublicEligible: false\n---\n# {{period}}\n`,
    );
    await writeFile(
      path.join(root, 'templates', 'monthly-review.md'),
      `---\ntitle: 월간 회고\nkind: monthly-review\ndefaultPath: reviews/monthly\npublicEligible: false\n---\n# {{period}}\n`,
    );
    const app = createApp(new ServerFileStore(root));

    for (const input of [
      { templateId: 'weekly-review', title: 'Missing' },
      { templateId: 'weekly-review', title: 'Invalid week', period: '2026-W54' },
      { templateId: 'monthly-review', title: 'Invalid month', period: '2026-13' },
    ]) {
      const response = await app.request('/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      expect(response.status).toBe(400);
    }

    const response = await app.request('/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        templateId: 'weekly-review',
        title: 'Valid week',
        period: '2026-W33',
      }),
    });
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string; source: string };
    expect(created).toMatchObject({
      kind: 'weekly-review',
      source: expect.stringContaining('period: 2026-W33'),
    });

    const invalidUpdate = await app.request(`/api/documents/${created.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: created.source.replace('2026-W33', '2026-W54') }),
    });
    expect(invalidUpdate.status).toBe(400);
  });
});

it('읽지 못한 파일을 목록과 함께 알린다', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'workbench-api-'));
  await mkdir(path.join(root, 'notes'), { recursive: true });
  await writeFile(
    path.join(root, 'notes', 'ok.md'),
    `---\ntitle: 정상\nkind: note\ncreatedAt: 2026-08-12\nupdatedAt: 2026-08-12\n---\n본문\n`,
  );
  await writeFile(path.join(root, 'notes', 'broken.md'), `---\ntitle: 깨진 것\n---\n본문\n`);
  const app = createApp(new ServerFileStore(root));

  const response = await app.request('/api/documents');
  const body = (await response.json()) as {
    documents: Array<Record<string, unknown>>;
    problems: Array<{ relativePath: string; message: string }>;
  };

  expect(response.status).toBe(200);
  expect(body.documents).toHaveLength(1);
  expect(body.problems).toHaveLength(1);
  expect(body.problems[0]?.relativePath).toBe('notes/broken.md');
});

it('NOR-227 AC-1: 목록 요약은 문서의 카테고리를 싣는다', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'workbench-api-'));
  await mkdir(path.join(root, 'drafts'));
  await writeFile(
    path.join(root, 'drafts', 'post.md'),
    `---\ntitle: 글\nkind: public-draft\ncreatedAt: 2026-11-15\nupdatedAt: 2026-11-15\npublicEligible: true\nslug: post\ncategory: Programming\n---\n본문\n`,
  );
  const app = createApp(new ServerFileStore(root));
  const listed = (await (await app.request('/api/documents')).json()) as {
    documents: Array<Record<string, unknown>>;
    problems: unknown[];
  };
  expect(listed.problems).toEqual([]);
  expect(listed.documents).toHaveLength(1);
  expect(listed.documents[0]).toHaveProperty('category', 'Programming');
});

it('NOR-252 AC-4: 공개 초안의 영어판을 만들고, 이미 있으면 409 다', async () => {
  const { mkdtemp, mkdir, writeFile, readFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { encodeDocumentId } = await import('../documentIds.js');
  const root = await mkdtemp(path.join(tmpdir(), 'translation-'));
  await mkdir(path.join(root, 'drafts'), { recursive: true });
  await writeFile(
    path.join(root, 'drafts', 'devlog-1.md'),
    "---\ntitle: 개발기\nkind: public-draft\ncreatedAt: 2026-11-20\nupdatedAt: 2026-11-21\npublicEligible: true\ndescription: 설명\nslug: devlog-1\ncategory: 개발기\ntags: ['unity']\npublishedAt: 2026-11-21\n---\n본문\n",
  );
  const app = createApp(new ServerFileStore(root));
  const id = encodeDocumentId('drafts/devlog-1.md');
  const created = await app.request(`/api/documents/${id}/translation`, { method: 'POST' });
  expect(created.status).toBe(201);
  const body = (await created.json()) as { id: string; source: string; title: string };
  expect(body.id).toBe(encodeDocumentId('drafts/devlog-1.en.md'));
  expect(body.source).toContain('lang: en');
  expect(await readFile(path.join(root, 'drafts', 'devlog-1.md'), 'utf8')).toContain(
    'translationKey: devlog-1',
  );
  expect((await app.request(`/api/documents/${id}/translation`, { method: 'POST' })).status).toBe(
    409,
  );
});
