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
