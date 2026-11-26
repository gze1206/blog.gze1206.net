import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

const IDS = ['01M83945Q72TNSZD8E69SVBWME', '01M83945Q72TNSZD8E69SVBWMF'];

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'schedule-'));
  const routes = await import('./schedule.js');
  const store = await import('../adapters/scheduleStore.js');
  const ids = [...IDS];
  const app = routes.createScheduleRoutes(new store.ServerScheduleStore(root), {
    createId: () => ids.shift() ?? 'none',
  });
  const send = (method: string, url: string, body?: unknown) =>
    app.request(url, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { root, send };
}

it('NOR-242 AC-5: 일정을 만들고 기간으로 조회하고 범위로 고치고 지운다', async () => {
  const { root, send } = await fixture();
  const created = await send('POST', '/api/schedule/events', {
    title: '주간 회의',
    date: '2026-11-26',
    time: '10:00',
    repeat: { freq: 'weekly', interval: 1 },
    exceptions: [],
    notes: '',
  });
  expect(created.status).toBe(201);
  expect(await created.json()).toMatchObject({ id: IDS[0], title: '주간 회의' });
  expect(await readdir(path.join(root, 'schedule'))).toEqual([`${IDS[0]}.md`]);
  expect(await readFile(path.join(root, 'schedule', `${IDS[0]}.md`), 'utf8')).toContain(
    '주간 회의',
  );

  const listed = await send('GET', '/api/schedule?from=2026-11-26&to=2026-12-10');
  expect(listed.status).toBe(200);
  const body = (await listed.json()) as { occurrences: { date: string }[]; problems: unknown[] };
  expect(body.occurrences.map((item) => item.date)).toEqual([
    '2026-11-26',
    '2026-12-03',
    '2026-12-10',
  ]);
  expect(body.problems).toEqual([]);

  const read = await send('GET', `/api/schedule/events/${IDS[0]}`);
  expect(await read.json()).toMatchObject({ id: IDS[0], repeat: { freq: 'weekly' } });

  const edited = await send('PUT', `/api/schedule/events/${IDS[0]}`, {
    scope: 'this',
    occurrenceDate: '2026-12-03',
    event: {
      title: '옮긴 회의',
      date: '2026-12-04',
      time: '15:00',
      repeat: { freq: 'weekly', interval: 1 },
      exceptions: [],
      notes: '',
    },
  });
  expect(edited.status).toBe(200);
  const after = (await (
    await send('GET', '/api/schedule?from=2026-11-26&to=2026-12-10')
  ).json()) as {
    occurrences: { date: string; title: string }[];
  };
  expect(after.occurrences.map((item) => `${item.date} ${item.title}`)).toEqual([
    '2026-11-26 주간 회의',
    '2026-12-04 옮긴 회의',
    '2026-12-10 주간 회의',
  ]);

  expect(
    (await send('DELETE', `/api/schedule/events/${IDS[0]}?scope=all&date=2026-11-26`)).status,
  ).toBe(204);
  expect((await send('GET', `/api/schedule/events/${IDS[0]}`)).status).toBe(404);
});

it('NOR-242 AC-5: 잘못된 입력은 400, 없는 일정은 404, 400일 넘는 조회는 400 이다', async () => {
  const { send } = await fixture();
  expect(
    (await send('POST', '/api/schedule/events', { title: '', date: '2026-11-26' })).status,
  ).toBe(400);
  expect((await send('GET', '/api/schedule/events/01M83945Q72TNSZD8E69SVBWMZ')).status).toBe(404);
  expect((await send('GET', '/api/schedule/events/../etc')).status).toBeGreaterThanOrEqual(400);
  expect((await send('GET', '/api/schedule?from=2026-01-01&to=2027-03-01')).status).toBe(400);
  expect((await send('GET', '/api/schedule?from=2026-12-01&to=2026-11-01')).status).toBe(400);
  expect(
    (
      await send(
        'DELETE',
        '/api/schedule/events/01M83945Q72TNSZD8E69SVBWMZ?scope=all&date=2026-11-26',
      )
    ).status,
  ).toBe(404);
});

it('NOR-242 AC-5: 앱에 붙여도 잘못된 입력은 400, 없는 일정은 404 다', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'schedule-app-'));
  const { createApp } = await import('../app.js');
  const { ServerFileStore } = await import('../adapters/fileStore.js');
  const { ServerJournalStore } = await import('../adapters/journalStore.js');
  const { ServerScheduleStore } = await import('../adapters/scheduleStore.js');
  const app = createApp(
    new ServerFileStore(root),
    new ServerJournalStore(root),
    undefined,
    undefined,
    undefined,
    undefined,
    new ServerScheduleStore(root),
  );
  const bad = await app.request('/api/schedule/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '', date: '2026-11-26' }),
  });
  expect(bad.status).toBe(400);
  expect((await app.request('/api/schedule/events/01M83945Q72TNSZD8E69SVBWMZ')).status).toBe(404);
  expect((await app.request('/api/schedule?from=2026-11-01&to=2026-11-30')).status).toBe(200);
});

it('NOR-248 AC-2: 회차 완료를 켜고 끈다', async () => {
  const { send } = await fixture();
  await send('POST', '/api/schedule/events', {
    title: '매주 운동',
    date: '2026-11-26',
    repeat: { freq: 'weekly', interval: 1 },
    exceptions: [],
    notes: '',
  });
  const on = await send('POST', `/api/schedule/events/${IDS[0]}/completion`, {
    date: '2026-12-03',
    completed: true,
  });
  expect(on.status).toBe(200);
  const listed = (await (
    await send('GET', '/api/schedule?from=2026-11-26&to=2026-12-03')
  ).json()) as {
    occurrences: { date: string; completed: boolean }[];
  };
  expect(listed.occurrences.map((item) => [item.date, item.completed])).toEqual([
    ['2026-11-26', false],
    ['2026-12-03', true],
  ]);
  await send('POST', `/api/schedule/events/${IDS[0]}/completion`, {
    date: '2026-12-03',
    completed: false,
  });
  expect(await (await send('GET', `/api/schedule/events/${IDS[0]}`)).json()).toMatchObject({
    completed: [],
  });
  expect(
    (
      await send('POST', '/api/schedule/events/01M83945Q72TNSZD8E69SVBWMZ/completion', {
        date: '2026-12-03',
        completed: true,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await send('POST', `/api/schedule/events/${IDS[0]}/completion`, {
        date: '2026-13-01',
        completed: true,
      })
    ).status,
  ).toBe(400);
});

it('NOR-248 AC-3: 일지의 ○ 불렛을 같은 날짜의 종일 일정으로 바꾸고 불렛을 지운다', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'schedule-bullet-'));
  const { writeFile, mkdir } = await import('node:fs/promises');
  const journal = path.join(root, 'journal', '2026', '11', '2026-11-26.md');
  await mkdir(path.dirname(journal), { recursive: true });
  const eventId = '01J5AR7W6M3Q9N8K2T4V1X0ZBC';
  const taskId = '01J5AR7W6M3Q9N8K2T4V1X0ZBD';
  await writeFile(
    journal,
    `---\ntitle: 2026-11-26\nkind: journal\ncreatedAt: 2026-11-26\nupdatedAt: 2026-11-26\ndate: 2026-11-26\n---\n# 2026-11-26\n\n- ○ 닷넷 컨퍼런스 참여 <!-- wb:id=${eventId} -->\n- □ 할 일 <!-- wb:id=${taskId} -->\n`,
  );
  const routes = await import('./schedule.js');
  const { ServerScheduleStore } = await import('../adapters/scheduleStore.js');
  const { ServerJournalStore } = await import('../adapters/journalStore.js');
  const ids = [...IDS];
  const app = routes.createScheduleRoutes(new ServerScheduleStore(root), {
    createId: () => ids.shift() ?? 'none',
    journal: new ServerJournalStore(root),
  });
  const converted = await app.request(`/api/days/2026-11-26/bullets/${eventId}/schedule`, {
    method: 'POST',
  });
  expect(converted.status).toBe(201);
  expect(await converted.json()).toMatchObject({
    id: IDS[0],
    title: '닷넷 컨퍼런스 참여',
    date: '2026-11-26',
  });
  const source = await readFile(journal, 'utf8');
  expect(source).not.toContain('닷넷 컨퍼런스 참여');
  expect(source).toContain('할 일');
  expect(
    (await app.request(`/api/days/2026-11-26/bullets/${taskId}/schedule`, { method: 'POST' }))
      .status,
  ).toBe(400);
});
