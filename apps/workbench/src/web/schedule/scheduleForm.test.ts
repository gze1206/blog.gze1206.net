import { describe, expect, it } from 'vitest';

async function form() {
  const mod = await import('./scheduleForm.js');
  expect(mod).toHaveProperty('formToInput');
  return mod;
}

describe('NOR-243 일정 대화 상자 변환', () => {
  it('NOR-243 AC-6: 종일이면 시각을 빼고 빈 장소·메모를 정리한다', async () => {
    const { emptyForm, formToInput } = await form();
    const base = emptyForm('2026-11-26');
    expect(base).toMatchObject({ date: '2026-11-26', allDay: true, repeat: 'none' });
    expect(
      formToInput({ ...base, title: ' 휴가 ', time: '10:00', endTime: '11:00', location: '  ' }),
    ).toEqual({ title: '휴가', date: '2026-11-26', exceptions: [], notes: '' });
    expect(
      formToInput({
        ...base,
        title: '회의',
        allDay: false,
        time: '10:00',
        endTime: '11:00',
        location: '본사',
      }),
    ).toEqual({
      title: '회의',
      date: '2026-11-26',
      time: '10:00',
      endTime: '11:00',
      location: '본사',
      exceptions: [],
      notes: '',
    });
  });

  it('NOR-243 AC-6: 반복 끝 방식에 따라 until·count 중 하나만 넣는다', async () => {
    const { emptyForm, formToInput } = await form();
    const weekly = {
      ...emptyForm('2026-11-26'),
      title: '회의',
      repeat: 'weekly' as const,
      interval: '2',
      weekdays: ['thu' as const, 'mon' as const],
      until: '2027-01-01',
      count: '5',
    };
    expect(formToInput({ ...weekly, ends: 'never' }).repeat).toEqual({
      freq: 'weekly',
      interval: 2,
      weekdays: ['thu', 'mon'],
    });
    expect(formToInput({ ...weekly, ends: 'until' }).repeat).toMatchObject({ until: '2027-01-01' });
    expect(formToInput({ ...weekly, ends: 'until' }).repeat).not.toHaveProperty('count');
    expect(formToInput({ ...weekly, ends: 'count' }).repeat).toMatchObject({ count: 5 });
    expect(formToInput({ ...weekly, repeat: 'monthly', ends: 'never' }).repeat).toEqual({
      freq: 'monthly',
      interval: 2,
    });
  });

  it('NOR-243 AC-6: 일정을 회차 날짜로 대화 상자에 채우고 여러 날 일정은 길이를 지킨다', async () => {
    const { formFromEvent, formToInput } = await form();
    const event = {
      id: '01M83945Q72TNSZD8E69SVBWME',
      title: '출장',
      date: '2026-11-30',
      endDate: '2026-12-02',
      repeat: { freq: 'monthly' as const, interval: 1, count: 3 },
      exceptions: ['2027-01-30'],
      notes: '메모',
    };
    const filled = formFromEvent(event, '2026-12-30');
    expect(filled).toMatchObject({
      date: '2026-12-30',
      endDate: '2027-01-01',
      repeat: 'monthly',
      ends: 'count',
      count: '3',
      notes: '메모',
    });
    expect(formToInput(filled)).toMatchObject({
      endDate: '2027-01-01',
      exceptions: ['2027-01-30'],
    });
  });
});

describe('NOR-243 달력 칸', () => {
  it('NOR-243 AC-6: 월 달력은 일요일부터 42칸이다', async () => {
    const { monthGrid } = await form();
    const days = monthGrid(2026, 8);
    expect(days).toHaveLength(42);
    expect(days[0]).toBe('2026-07-26');
    expect(days[41]).toBe('2026-09-05');
    expect(monthGrid(2026, 11)[0]).toBe('2026-11-01');
  });
});
