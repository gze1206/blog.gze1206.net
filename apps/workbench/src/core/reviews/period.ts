import { calendarDateInTimeZone } from './calendar.js';

export type ReviewKind = 'weekly-review' | 'monthly-review';

export interface EndedReviewPeriod {
  readonly kind: ReviewKind;
  readonly period: string;
  readonly endedOn: string;
}

export interface EndedReviewPeriods {
  readonly weekly: EndedReviewPeriod;
  readonly monthly: EndedReviewPeriod;
}

export function getEndedReviewPeriods(now: Date, timeZone: string): EndedReviewPeriods {
  const localDate = calendarDateInTimeZone(now, timeZone);
  // Resolve the app-local Y-M-D first, then use UTC only as a host-independent calendar surrogate.
  const date = utcDate(
    Number(localDate.slice(0, 4)),
    Number(localDate.slice(5, 7)) - 1,
    Number(localDate.slice(8, 10)),
  );
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  const currentMonday = addDays(date, -daysSinceMonday);
  const previousSunday = addDays(currentMonday, -1);
  const previousMonday = addDays(currentMonday, -7);
  const previousMonthEnd = utcDate(date.getUTCFullYear(), date.getUTCMonth(), 0);

  return {
    weekly: {
      kind: 'weekly-review',
      period: isoWeekPeriod(previousMonday),
      endedOn: calendarDate(previousSunday),
    },
    monthly: {
      kind: 'monthly-review',
      period: calendarDate(previousMonthEnd).slice(0, 7),
      endedOn: calendarDate(previousMonthEnd),
    },
  };
}

export function isCurrentOrPastReviewPeriod(
  now: Date,
  timeZone: string,
  kind: ReviewKind,
  period: string,
): boolean {
  const localDate = calendarDateInTimeZone(now, timeZone);
  const local = utcDate(
    Number(localDate.slice(0, 4)),
    Number(localDate.slice(5, 7)) - 1,
    Number(localDate.slice(8, 10)),
  );
  if (kind === 'monthly-review') {
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(period)) return false;
    const current = localDate.slice(0, 7);
    return period <= current;
  }

  const match = /^(?<year>\d{4})-W(?<week>0[1-9]|[1-4]\d|5[0-3])$/u.exec(period)?.groups;
  if (!match) return false;
  const year = Number(match.year);
  const week = Number(match.week);
  const lastWeek = Number(isoWeekPeriod(utcDate(year, 11, 28)).slice(-2));
  if (week > lastWeek) return false;
  return period <= isoWeekPeriod(local);
}

function isoWeekPeriod(date: Date): string {
  const thursday = addDays(date, 3 - ((date.getUTCDay() + 6) % 7));
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = utcDate(isoYear, 0, 4);
  const firstWeekThursday = addDays(firstThursday, 3 - ((firstThursday.getUTCDay() + 6) % 7));
  const week = 1 + Math.round((thursday.getTime() - firstWeekThursday.getTime()) / 604_800_000);
  return `${String(isoYear).padStart(4, '0')}-W${String(week).padStart(2, '0')}`;
}

function utcDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function calendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
