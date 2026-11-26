/** 반복 일정을 회차로 펼친다(NOR-242). */
import { addDays, dayNumber, makeDate, weekdayIndex } from './days.js';
import { WEEKDAYS, type ScheduleEvent } from './event.js';

export interface Occurrence {
  readonly eventId: string;
  readonly title: string;
  /** 회차의 시작 날짜. */
  readonly date: string;
  /** 회차의 끝 날짜. 하루짜리면 시작과 같다. */
  readonly endDate: string;
  readonly time?: string;
  readonly endTime?: string;
  readonly location?: string;
  readonly recurring: boolean;
  /** 이 회차를 끝냈는지(NOR-248). */
  readonly completed: boolean;
}

/** 후보 시작 날짜를 차례로 낸다. 없는 날(31일·2월 29일)은 null 과 그 무렵 날짜(`near`)를 낸다. */
function* candidates(event: ScheduleEvent): Generator<{ date: string | null; near: string }> {
  const rule = event.repeat;
  if (rule === undefined) {
    yield { date: event.date, near: event.date };
    return;
  }
  const [year = 0, month = 1, day = 1] = event.date.split('-').map(Number);
  switch (rule.freq) {
    case 'daily':
      for (let step = 0; ; step += 1) {
        const date = addDays(event.date, step * rule.interval);
        yield { date, near: date };
      }
    case 'weekly': {
      const days = (rule.weekdays ?? [WEEKDAYS[weekdayIndex(event.date)] ?? 'mon'])
        .map((weekday) => WEEKDAYS.indexOf(weekday))
        .sort((left, right) => left - right);
      const weekStart = addDays(event.date, -weekdayIndex(event.date));
      for (let week = 0; ; week += 1) {
        for (const offset of days) {
          const date = addDays(weekStart, week * 7 * rule.interval + offset);
          if (dayNumber(date) < dayNumber(event.date)) continue;
          yield { date, near: date };
        }
      }
    }
    case 'monthly':
      for (let step = 0; ; step += 1) {
        const index = month - 1 + step * rule.interval;
        const y = year + Math.floor(index / 12);
        const m = (index % 12) + 1;
        yield { date: makeDate(y, m, day), near: makeDate(y, m, 1) ?? event.date };
      }
    case 'yearly':
      for (let step = 0; ; step += 1) {
        const y = year + step * rule.interval;
        yield { date: makeDate(y, month, day), near: makeDate(y, month, 1) ?? event.date };
      }
  }
}

/** 일정의 회차 시작 날짜 가운데 `before` 보다 이른 것의 수(예외 포함). "이후" 범위에서 남은 횟수를 센다. */
export function countBefore(event: ScheduleEvent, before: string): number {
  let count = 0;
  for (const candidate of candidates(event)) {
    if (dayNumber(candidate.near) >= dayNumber(before)) break;
    if (candidate.date === null) continue;
    if (dayNumber(candidate.date) >= dayNumber(before)) break;
    count += 1;
    if (event.repeat?.count !== undefined && count >= event.repeat.count) break;
  }
  return count;
}

/** `from`~`to`(둘 다 포함)와 겹치는 회차. */
export function occurrencesBetween(event: ScheduleEvent, from: string, to: string): Occurrence[] {
  const span = event.endDate === undefined ? 0 : dayNumber(event.endDate) - dayNumber(event.date);
  const exceptions = new Set(event.exceptions);
  const until = event.repeat?.until;
  const limit = event.repeat?.count;
  const result: Occurrence[] = [];
  let produced = 0;
  for (const candidate of candidates(event)) {
    if (dayNumber(candidate.near) > dayNumber(to)) break;
    if (candidate.date === null) continue;
    if (until !== undefined && dayNumber(candidate.date) > dayNumber(until)) break;
    if (dayNumber(candidate.date) > dayNumber(to)) break;
    produced += 1;
    const endDate = addDays(candidate.date, span);
    if (!exceptions.has(candidate.date) && dayNumber(endDate) >= dayNumber(from))
      result.push({
        eventId: event.id,
        title: event.title,
        date: candidate.date,
        endDate,
        ...(event.time === undefined ? {} : { time: event.time }),
        ...(event.endTime === undefined ? {} : { endTime: event.endTime }),
        ...(event.location === undefined ? {} : { location: event.location }),
        recurring: event.repeat !== undefined,
        completed: event.completed.includes(candidate.date),
      });
    if (limit !== undefined && produced >= limit) break;
  }
  return result;
}

/** 여러 일정을 펼쳐 날짜순, 같은 날은 종일 먼저, 그다음 시각·제목순으로 놓는다. */
export function expandSchedule(
  events: readonly ScheduleEvent[],
  from: string,
  to: string,
): Occurrence[] {
  return events
    .flatMap((event) => occurrencesBetween(event, from, to))
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        (left.time ?? '').localeCompare(right.time ?? '') ||
        left.title.localeCompare(right.title),
    );
}
