/** 일정 대화 상자의 값과 API 입력 사이의 변환, 달력 칸 계산(NOR-243). DOM 없이 시험한다. */
import { addDays, dayNumber, makeDate, weekdayIndex } from '../../core/schedule/days.js';
import type { Occurrence } from '../../core/schedule/recurrence.js';
import type {
  RepeatFrequency,
  ScheduleEvent,
  ScheduleEventInput,
  Weekday,
} from '../../core/schedule/event.js';

export interface EventForm {
  readonly title: string;
  readonly allDay: boolean;
  readonly date: string;
  /** 여러 날 일정의 끝 날짜. 비면 하루짜리다. */
  readonly endDate: string;
  readonly time: string;
  readonly endTime: string;
  readonly location: string;
  readonly repeat: 'none' | RepeatFrequency;
  readonly interval: string;
  readonly weekdays: readonly Weekday[];
  readonly ends: 'never' | 'until' | 'count';
  readonly until: string;
  readonly count: string;
  readonly notes: string;
  /** 화면에 보이지 않지만 고칠 때 지켜야 하는 예외 날짜. */
  readonly exceptions: readonly string[];
}

export function emptyForm(date: string): EventForm {
  return {
    title: '',
    allDay: true,
    date,
    endDate: '',
    time: '',
    endTime: '',
    location: '',
    repeat: 'none',
    interval: '1',
    weekdays: [],
    ends: 'never',
    until: '',
    count: '',
    notes: '',
    exceptions: [],
  };
}

/** 일정을 회차 날짜(`occurrenceDate`)로 채운다. 여러 날 일정은 길이를 지킨다. */
export function formFromEvent(event: ScheduleEvent, occurrenceDate: string): EventForm {
  const span = event.endDate === undefined ? 0 : dayNumber(event.endDate) - dayNumber(event.date);
  const rule = event.repeat;
  return {
    title: event.title,
    allDay: event.time === undefined,
    date: occurrenceDate,
    endDate: span === 0 ? '' : addDays(occurrenceDate, span),
    time: event.time ?? '',
    endTime: event.endTime ?? '',
    location: event.location ?? '',
    repeat: rule?.freq ?? 'none',
    interval: String(rule?.interval ?? 1),
    weekdays: rule?.weekdays ?? [],
    ends: rule?.until !== undefined ? 'until' : rule?.count !== undefined ? 'count' : 'never',
    until: rule?.until ?? '',
    count: rule?.count === undefined ? '' : String(rule.count),
    notes: event.notes,
    exceptions: event.exceptions,
  };
}

export function formToInput(form: EventForm): ScheduleEventInput {
  const timed = !form.allDay && form.time !== '';
  const location = form.location.trim();
  const repeat =
    form.repeat === 'none'
      ? undefined
      : {
          freq: form.repeat,
          interval: Math.max(1, Number.parseInt(form.interval, 10) || 1),
          ...(form.repeat === 'weekly' && form.weekdays.length > 0
            ? { weekdays: form.weekdays }
            : {}),
          ...(form.ends === 'until' && form.until !== '' ? { until: form.until } : {}),
          ...(form.ends === 'count' && form.count !== ''
            ? { count: Math.max(1, Number.parseInt(form.count, 10) || 1) }
            : {}),
        };
  return {
    title: form.title.trim(),
    date: form.date,
    ...(form.endDate !== '' && form.endDate !== form.date ? { endDate: form.endDate } : {}),
    ...(timed ? { time: form.time } : {}),
    ...(timed && form.endTime !== '' ? { endTime: form.endTime } : {}),
    ...(location === '' ? {} : { location }),
    ...(repeat === undefined ? {} : { repeat }),
    exceptions: form.exceptions,
    notes: form.notes.trim() === '' ? '' : form.notes,
  };
}

/** 일요일부터 시작하는 6주(42칸). `month` 는 1~12. */
export function monthGrid(year: number, month: number): string[] {
  const first = makeDate(year, month, 1);
  if (first === null) throw new Error('invalid month');
  const start = addDays(first, -((weekdayIndex(first) + 1) % 7));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthOf(date: string) {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

/** 목록에 보이는 시각. 시각이 없으면 종일이다. */
export function timeLabel(item: Occurrence): string {
  if (item.time === undefined) return '종일';
  return item.endTime === undefined ? item.time : `${item.time}–${item.endTime}`;
}
