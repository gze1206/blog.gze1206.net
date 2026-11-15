import { access, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ServerFileStore } from '../adapters/fileStore.js';
import { ServerJournalStore } from '../adapters/journalStore.js';
import { createApp } from '../app.js';

const sourceId = '01J5AR7W6M3Q9N8K2T4V1X0ZBC';
const targetId = '01J5AR7W6M3Q9N8K2T4V1X0ZBD';

describe('/api/days and /api/bullets', () => {
  it('returns an empty day without creating or automatically migrating a journal', async () => {
    const { root, app } = await fixture();
    await seedJournal(root, '2026-08-11', `- □ 남은 일 <!-- wb:id=${sourceId} -->`);

    const response = await app.request('/api/days/2026-08-12');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ date: '2026-08-12', bullets: [] });
    await expect(access(journalPath(root, '2026-08-12'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(journalPath(root, '2026-08-11'), 'utf8')).not.toContain('migrated-to');
  });

  it('adds a keyboard capture with a stable id and lists only older open tasks for review', async () => {
    const { root, app } = await fixture([sourceId]);
    await seedJournal(root, '2026-08-10', `- ▣ 끝난 일 <!-- wb:id=${targetId} -->`);
    await seedJournal(root, '2026-08-11', `- □ 남은 일 <!-- wb:id=${targetId} -->`);

    const created = await app.request('/api/days/2026-08-12/bullets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'memo', text: '배포 메모' }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ id: sourceId, type: 'memo', text: '배포 메모' });
    expect(await readFile(journalPath(root, '2026-08-12'), 'utf8')).toContain(
      `- • 배포 메모 <!-- wb:id=${sourceId} -->`,
    );

    const review = await app.request('/api/bullets/review?before=2026-08-12');
    expect(await review.json()).toEqual({
      bullets: [expect.objectContaining({ id: targetId, date: '2026-08-11', status: 'open' })],
    });
  });

  it('preserves both parallel captures in one journal', async () => {
    const firstId = '01J5AR7W6M3Q9N8K2T4V1X0ZBF';
    const secondId = '01J5AR7W6M3Q9N8K2T4V1X0ZBG';
    const { root, app } = await fixture([firstId, secondId]);

    const responses = await Promise.all(
      ['첫 병렬 기록', '둘째 병렬 기록'].map((text) =>
        app.request('/api/days/2026-08-12/bullets', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'memo', text }),
        }),
      ),
    );

    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    const persisted = await readFile(journalPath(root, '2026-08-12'), 'utf8');
    expect(persisted).toContain(`첫 병렬 기록 <!-- wb:id=${firstId} -->`);
    expect(persisted).toContain(`둘째 병렬 기록 <!-- wb:id=${secondId} -->`);
  });

  it('acquires the workspace lock before a transaction can read', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-bullets-lock-'));
    const store = new ServerJournalStore(root);

    await store.runExclusive(async (transaction) => {
      await expect(access(path.join(root, '.workbench.lock'))).resolves.toBeUndefined();
      await expect(transaction.read('2026-08-12')).resolves.toBeNull();
    });
  });

  it.each([
    '정상처럼 보임\n- □ 주입 <!-- wb:id=01J5AR7W6M3Q9N8K2T4V1X0ZBH -->',
    '정상처럼 보임\r가짜 줄',
    '메타 주입 <!-- wb:migrated-to=01J5AR7W6M3Q9N8K2T4V1X0ZBH at=2026-08-12 -->',
  ])('rejects multiline or workbench metadata capture text: %s', async (text) => {
    const { app } = await fixture([sourceId]);
    const response = await app.request('/api/days/2026-08-12/bullets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'memo', text }),
    });
    expect(response.status).toBe(400);
  });

  it.each(['2026-02-30', '2025-02-29', '2026-04-31'])(
    'rejects non-Gregorian date %s',
    async (date) => {
      const { app } = await fixture();
      expect((await app.request(`/api/days/${date}`)).status).toBe(400);
      expect((await app.request(`/api/bullets/review?before=${date}`)).status).toBe(400);
    },
  );

  it('migrates only after explicit quick or intentional requests and persists both histories', async () => {
    const { root, app } = await fixture([targetId]);
    await seedJournal(root, '2026-08-11', `- □ 남은 일 <!-- wb:id=${sourceId} -->`);

    const rejected = await app.request(`/api/bullets/${sourceId}/migrate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceDate: '2026-08-11',
        targetDate: '2026-08-12',
        mode: 'intentional',
      }),
    });
    expect(rejected.status).toBe(400);
    expect(await readFile(journalPath(root, '2026-08-11'), 'utf8')).not.toContain('migrated-to');

    const migrated = await app.request(`/api/bullets/${sourceId}/migrate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceDate: '2026-08-11',
        targetDate: '2026-08-12',
        mode: 'intentional',
        confirmation: '가치를 다시 확인했습니다',
      }),
    });
    expect(migrated.status).toBe(201);
    expect(await migrated.json()).toMatchObject({ id: targetId, migratedFrom: sourceId });
    expect(await readFile(journalPath(root, '2026-08-11'), 'utf8')).toContain(
      `<!-- wb:migrated-to=${targetId} at=2026-08-12 -->`,
    );
    expect(await readFile(journalPath(root, '2026-08-12'), 'utf8')).toContain(
      `<!-- wb:migrated-from=${sourceId} -->`,
    );
  });

  it('changes task status and type only through an explicit action request', async () => {
    const { root, app } = await fixture();
    await seedJournal(root, '2026-08-12', `- □ 배포 확인 <!-- wb:id=${sourceId} -->`);

    const completed = await app.request(`/api/days/2026-08-12/bullets/${sourceId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    });
    expect(completed.status).toBe(200);
    expect(await completed.json()).toMatchObject({ id: sourceId, status: 'completed' });
    expect(await readFile(journalPath(root, '2026-08-12'), 'utf8')).toContain(
      `- ▣ 배포 확인 <!-- wb:id=${sourceId} -->`,
    );

    const cycled = await app.request(`/api/days/2026-08-12/bullets/${sourceId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'cycle-type' }),
    });
    expect(await cycled.json()).toMatchObject({ type: 'memo', status: 'open' });
  });
});

async function fixture(ids: string[] = []) {
  const root = await mkdtemp(path.join(tmpdir(), 'workbench-bullets-api-'));
  await mkdir(path.join(root, 'templates'));
  const nextId = () => ids.shift() ?? '01J5AR7W6M3Q9N8K2T4V1X0ZBE';
  const journalStore = new ServerJournalStore(root);
  return {
    root,
    app: createApp(new ServerFileStore(root), journalStore, {
      clock: () => new Date('2026-08-12T09:00:00+09:00'),
      createId: nextId,
    }),
  };
}

async function seedJournal(root: string, date: string, content: string) {
  const target = journalPath(root, date);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    `---\ntitle: ${date}\nkind: journal\ncreatedAt: ${date}\nupdatedAt: ${date}\ndate: ${date}\n---\n# ${date}\n\n${content}\n`,
  );
}

function journalPath(root: string, date: string): string {
  return path.join(root, 'journal', date.slice(0, 4), date.slice(5, 7), `${date}.md`);
}
