import { describe, expect, it } from 'vitest';

async function schedule() {
  const mod = await import('./index.js');
  expect(mod).toHaveProperty('occurrencesBetween');
  return mod;
}

const ID = '01M83945Q72TNSZD8E69SVBWME';
const base = { title: '회의', date: '2026-11-26', exceptions: [], notes: '' };
const dates = (items: readonly { date: string }[]) => items.map((item) => item.date);

describe('NOR-242 일정 파일', () => {
  it('NOR-242 AC-1: 읽고 쓰면 같은 값이 되고 시각은 따옴표로 쓴다', async () => {
    const { parseEvent, serializeEvent, validateEventInput } = await schedule();
    const event = {
      id: ID,
      ...validateEventInput({
        title: '팀 회의',
        date: '2026-11-26',
        time: '14:00',
        endTime: '15:30',
        location: '회의실',
        repeat: { freq: 'weekly', interval: 1, weekdays: ['thu', 'mon'], until: '2027-03-01' },
        exceptions: ['2026-12-24'],
        notes: '안건 정리\n',
      }),
    };
    const source = serializeEvent(event);
    expect(source).toContain('time: "14:00"');
    expect(source.endsWith('안건 정리\n')).toBe(true);
    expect(parseEvent(ID, source)).toEqual(event);
    // 요일은 월요일부터 정렬해 둔다.
    expect(event.repeat?.weekdays).toEqual(['mon', 'thu']);
  });

  it('NOR-242 AC-1: 잘못된 일정은 거절한다', async () => {
    const { validateEventInput } = await schedule();
    const bad = [
      { ...base, title: ' ' },
      { ...base, date: '2026-02-30' },
      { ...base, time: '25:00' },
      { ...base, time: '14:00', endTime: '13:00' },
      { ...base, endTime: '13:00' },
      { ...base, endDate: '2026-11-25' },
      { ...base, repeat: { freq: 'daily', interval: 0 } },
      { ...base, repeat: { freq: 'daily', interval: 1, until: '2026-12-01', count: 3 } },
      { ...base, repeat: { freq: 'daily', interval: 1, until: '2026-11-25' } },
      { ...base, repeat: { freq: 'hourly', interval: 1 } },
    ];
    for (const input of bad)
      expect(() => validateEventInput(input), JSON.stringify(input)).toThrow();
    expect(validateEventInput({ ...base, time: '09:00' })).toMatchObject({ time: '09:00' });
  });
});

describe('NOR-242 반복 전개', () => {
  it('NOR-242 AC-2: 매일·간격·횟수·예외', async () => {
    const { occurrencesBetween, validateEventInput } = await schedule();
    const event = {
      id: ID,
      ...validateEventInput({
        ...base,
        repeat: { freq: 'daily', interval: 2, count: 4 },
        exceptions: ['2026-11-28'],
      }),
    };
    // 횟수에는 예외로 뺀 회차도 들어간다(RFC 5545 와 같다).
    expect(dates(occurrencesBetween(event, '2026-11-01', '2026-12-31'))).toEqual([
      '2026-11-26',
      '2026-11-30',
      '2026-12-02',
    ]);
  });

  it('NOR-242 AC-2: 매주 요일 지정과 until', async () => {
    const { occurrencesBetween, validateEventInput } = await schedule();
    const event = {
      id: ID,
      ...validateEventInput({
        ...base,
        date: '2026-11-25',
        repeat: { freq: 'weekly', interval: 2, weekdays: ['mon', 'wed'], until: '2026-12-21' },
      }),
    };
    // 2026-11-25 는 수요일이다. 다음 회차는 두 주 뒤 월요일.
    expect(dates(occurrencesBetween(event, '2026-11-01', '2027-01-31'))).toEqual([
      '2026-11-25',
      '2026-12-07',
      '2026-12-09',
      '2026-12-21',
    ]);
    const plain = {
      id: ID,
      ...validateEventInput({ ...base, repeat: { freq: 'weekly', interval: 1 } }),
    };
    expect(dates(occurrencesBetween(plain, '2026-11-26', '2026-12-10'))).toEqual([
      '2026-11-26',
      '2026-12-03',
      '2026-12-10',
    ]);
  });

  it('NOR-242 AC-2: 매월 31일과 매년 2월 29일은 없는 달·해를 건너뛴다', async () => {
    const { occurrencesBetween, validateEventInput } = await schedule();
    const monthly = {
      id: ID,
      ...validateEventInput({
        ...base,
        date: '2026-01-31',
        repeat: { freq: 'monthly', interval: 1 },
      }),
    };
    expect(dates(occurrencesBetween(monthly, '2026-01-01', '2026-06-30'))).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
    ]);
    const yearly = {
      id: ID,
      ...validateEventInput({
        ...base,
        date: '2024-02-29',
        repeat: { freq: 'yearly', interval: 1 },
      }),
    };
    expect(dates(occurrencesBetween(yearly, '2024-01-01', '2032-12-31'))).toEqual([
      '2024-02-29',
      '2028-02-29',
      '2032-02-29',
    ]);
  });

  it('NOR-242 AC-3: 여러 날에 걸친 회차는 기간과 겹치면 나오고 시작·끝을 함께 돌려준다', async () => {
    const { occurrencesBetween, expandSchedule, validateEventInput } = await schedule();
    const trip = {
      id: ID,
      ...validateEventInput({
        ...base,
        title: '출장',
        date: '2026-11-30',
        endDate: '2026-12-02',
        repeat: { freq: 'monthly', interval: 1, count: 2 },
      }),
    };
    expect(occurrencesBetween(trip, '2026-12-01', '2026-12-29')).toEqual([
      expect.objectContaining({
        eventId: ID,
        date: '2026-11-30',
        endDate: '2026-12-02',
        recurring: true,
      }),
    ]);
    const meeting = {
      id: '01M83945Q72TNSZD8E69SVBWMF',
      ...validateEventInput({ ...base, date: '2026-12-01', time: '09:00' }),
    };
    const allDay = {
      id: '01M83945Q72TNSZD8E69SVBWMG',
      ...validateEventInput({ ...base, title: '종일', date: '2026-12-01' }),
    };
    // 날짜순, 같은 날은 종일이 먼저, 그다음 시각순이다.
    expect(
      expandSchedule([meeting, trip, allDay], '2026-12-01', '2026-12-01').map((item) => item.title),
    ).toEqual(['출장', '종일', '회의']);
  });
});

describe('NOR-242 고치기·지우기 범위', () => {
  const weekly = async () => {
    const mod = await schedule();
    const event = {
      id: ID,
      ...mod.validateEventInput({
        ...base,
        time: '10:00',
        repeat: { freq: 'weekly', interval: 1, count: 10 },
      }),
    };
    return { mod, event };
  };
  const NEW_ID = '01M83945Q72TNSZD8E69SVBWMH';

  it('NOR-242 AC-4: 이 일정만 고치면 그 회차를 예외로 두고 한 번짜리 일정을 만든다', async () => {
    const { mod, event } = await weekly();
    // 고친 값은 화면에 보인 회차다. 날짜는 그 회차의 날짜다.
    const occurrence = { ...event, date: '2026-12-10' };
    const plan = mod.planEdit(
      event,
      'this',
      '2026-12-10',
      { ...occurrence, time: '11:00' },
      NEW_ID,
    );
    expect(plan.update).toMatchObject({ id: ID, exceptions: ['2026-12-10'], time: '10:00' });
    expect(plan.create).toMatchObject({
      id: NEW_ID,
      date: '2026-12-10',
      time: '11:00',
      exceptions: [],
    });
    expect(plan.create?.repeat).toBeUndefined();
  });

  it('NOR-242 AC-4: 이후 모든 일정을 고치면 원래 일정을 전날에서 끝내고 남은 횟수로 새 반복을 만든다', async () => {
    const { mod, event } = await weekly();
    const occurrence = { ...event, date: '2026-12-10' };
    const plan = mod.planEdit(
      event,
      'following',
      '2026-12-10',
      { ...occurrence, title: '새 회의' },
      NEW_ID,
    );
    expect(plan.update?.repeat).toEqual({ freq: 'weekly', interval: 1, until: '2026-12-09' });
    expect(plan.create).toMatchObject({
      id: NEW_ID,
      title: '새 회의',
      date: '2026-12-10',
      repeat: { freq: 'weekly', interval: 1, count: 8 },
    });
    // 첫 회차에서 "이후" 는 "모든 일정" 과 같다.
    const first = mod.planEdit(
      event,
      'following',
      '2026-11-26',
      { ...event, title: '전체' },
      NEW_ID,
    );
    expect(first).toEqual({ update: { ...event, title: '전체' } });
  });

  it('NOR-242 AC-4: 모든 일정을 고치면 같은 id 로 고치고, 회차 날짜를 옮긴 만큼 시작일을 옮긴다', async () => {
    const { mod, event } = await weekly();
    const occurrence = { ...event, date: '2026-12-10' };
    expect(
      mod.planEdit(event, 'all', '2026-12-10', { ...occurrence, title: '전체' }, NEW_ID),
    ).toEqual({
      update: { ...event, title: '전체' },
    });
    expect(
      mod.planEdit(event, 'all', '2026-12-10', { ...occurrence, date: '2026-12-11' }, NEW_ID),
    ).toEqual({ update: { ...event, date: '2026-11-27' } });
  });

  it('NOR-242 AC-4: 지우기 범위', async () => {
    const { mod, event } = await weekly();
    expect(mod.planDelete(event, 'this', '2026-12-10')).toEqual({
      update: { ...event, exceptions: ['2026-12-10'] },
    });
    expect(mod.planDelete(event, 'following', '2026-12-10')).toEqual({
      update: { ...event, repeat: { freq: 'weekly', interval: 1, until: '2026-12-09' } },
    });
    expect(mod.planDelete(event, 'following', '2026-11-26')).toEqual({ remove: true });
    expect(mod.planDelete(event, 'all', '2026-12-10')).toEqual({ remove: true });
    const { repeat: _repeat, ...once } = event;
    expect(mod.planDelete(once, 'this', '2026-11-26')).toEqual({ remove: true });
  });
});
