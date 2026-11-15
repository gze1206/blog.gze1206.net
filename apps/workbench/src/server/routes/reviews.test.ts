import { access, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ServerFileStore } from '../adapters/fileStore.js';
import { ServerJournalStore } from '../adapters/journalStore.js';
import { createApp } from '../app.js';

const bulletId = '01J5AR7W6M3Q9N8K2T4V1X0ZBC';

describe('/api/reviews', () => {
  it('suggests at most one ended missing review without creating a file', async () => {
    const { root, app } = await fixture();

    const response = await app.request('/api/reviews/suggestion');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      today: '2026-08-12',
      suggestion: {
        kind: 'weekly-review',
        period: '2026-W32',
        endedOn: '2026-08-09',
      },
    });
    await expect(access(path.join(root, 'reviews'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('suppresses only a locally skipped period and returns the other missing candidate', async () => {
    const { app } = await fixture();

    const response = await app.request('/api/reviews/suggestion?skipped=weekly-review%3A2026-W32');

    expect(await response.json()).toEqual({
      today: '2026-08-12',
      suggestion: {
        kind: 'monthly-review',
        period: '2026-07',
        endedOn: '2026-07-31',
      },
    });
  });

  it('does not suggest a period that already has a matching review document', async () => {
    const { root, app } = await fixture();
    await seedReview(root, 'weekly-review', '2026-W32');
    await seedReview(root, 'monthly-review', '2026-07');

    expect(await (await app.request('/api/reviews/suggestion')).json()).toEqual({
      today: '2026-08-12',
      suggestion: null,
    });
  });

  it('manually creates current or past review templates and inserts verified bullet links', async () => {
    const { root, app } = await fixture();
    await seedJournal(root, '2026-08-11', `- □ 배포 [확인] <!-- wb:id=${bulletId} -->`);

    const response = await app.request('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'monthly-review',
        period: '2026-07',
        bulletReferences: [{ date: '2026-08-11', id: bulletId }],
      }),
    });

    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string; source: string };
    expect(created).not.toHaveProperty('relativePath');
    expect(created.source).toContain('period: 2026-07');
    expect(created.source).toContain(`- [배포 \\[확인\\]](/day/2026-08-11#bullet-${bulletId})`);
    expect(await readFile(path.join(root, 'reviews/monthly/2026-07.md'), 'utf8')).toBe(
      created.source,
    );

    const current = await app.request('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'weekly-review', period: '2026-W33' }),
    });
    expect(current.status).toBe(201);
  });

  it('rejects future, impossible, or unresolvable review creation input before writing', async () => {
    const { root, app } = await fixture();

    for (const body of [
      { kind: 'weekly-review', period: '2026-W34' },
      { kind: 'weekly-review', period: '2026-W53' },
      { kind: 'monthly-review', period: '2026-13' },
      {
        kind: 'weekly-review',
        period: '2026-W32',
        bulletReferences: [{ date: '2026-08-11', id: bulletId }],
      },
    ]) {
      const response = await app.request('/api/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
    }
    await expect(access(path.join(root, 'reviews'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('uses only the configured app timezone for period validation and stored document dates', async () => {
    const { root, app } = await fixture(new Date('2026-08-01T00:30:00+09:00'));

    expect(await (await app.request('/api/reviews/suggestion')).json()).toEqual({
      today: '2026-08-01',
      suggestion: {
        kind: 'monthly-review',
        period: '2026-07',
        endedOn: '2026-07-31',
      },
    });

    const created = await app.request('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'monthly-review', period: '2026-08' }),
    });

    expect(created.status).toBe(201);
    const stored = await readFile(path.join(root, 'reviews/monthly/2026-08.md'), 'utf8');
    expect(stored).toContain('createdAt: 2026-08-01');
    expect(stored).toContain('updatedAt: 2026-08-01');

    const injected = await app.request('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'weekly-review',
        period: '2026-W31',
        timeZone: 'UTC',
      }),
    });
    expect(injected.status).toBe(400);
    expect((await app.request('/api/reviews/suggestion?timeZone=UTC')).status).toBe(400);
  });
});

async function fixture(now = new Date('2026-08-12T12:00:00.000Z')) {
  const root = await mkdtemp(path.join(tmpdir(), 'workbench-reviews-api-'));
  await mkdir(path.join(root, 'templates'));
  for (const [file, kind, defaultPath, heading] of [
    ['weekly-review.md', 'weekly-review', 'reviews/weekly', '주간 회고'],
    ['monthly-review.md', 'monthly-review', 'reviews/monthly', '월간 회고'],
  ] as const) {
    await writeFile(
      path.join(root, 'templates', file),
      `---\ntitle: ${heading}\nkind: ${kind}\ndefaultPath: ${defaultPath}\npublicEligible: false\n---\n# {{period}} ${heading}\n`,
    );
  }
  const store = new ServerFileStore(root);
  const journal = new ServerJournalStore(root);
  return {
    root,
    app: createApp(
      store,
      journal,
      { clock: () => new Date('2026-08-12T12:00:00.000Z'), createId: () => bulletId },
      {
        clock: () => now,
        createId: () => 'review-id',
        timeZone: 'Asia/Seoul',
      },
    ),
  };
}

async function seedReview(root: string, kind: 'weekly-review' | 'monthly-review', period: string) {
  const frequency = kind === 'weekly-review' ? 'weekly' : 'monthly';
  await mkdir(path.join(root, 'reviews', frequency), { recursive: true });
  await writeFile(
    path.join(root, 'reviews', frequency, `${period}.md`),
    `---\ntitle: ${period}\nkind: ${kind}\ncreatedAt: 2026-08-12\nupdatedAt: 2026-08-12\nperiod: ${period}\n---\n# ${period}\n`,
  );
}

async function seedJournal(root: string, date: string, content: string) {
  const target = path.join(root, 'journal', date.slice(0, 4), date.slice(5, 7), `${date}.md`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    `---\ntitle: ${date}\nkind: journal\ncreatedAt: ${date}\nupdatedAt: ${date}\ndate: ${date}\n---\n# ${date}\n\n${content}\n`,
  );
}
