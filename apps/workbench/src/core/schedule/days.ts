/** 달력 날짜(`YYYY-MM-DD`) 계산. 시간대 없이 UTC 자정으로 센다(NOR-242). */
import { isCalendarDate } from '../bullets/date.js';

const DAY_MS = 86_400_000;

export function dayNumber(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function fromDayNumber(value: number): string {
  return new Date(value * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromDayNumber(dayNumber(date) + days);
}

/** 월요일 0 … 일요일 6. */
export function weekdayIndex(date: string): number {
  return (new Date(dayNumber(date) * DAY_MS).getUTCDay() + 6) % 7;
}

/** 실제로 있는 날이면 `YYYY-MM-DD`, 없으면(2월 30일 등) null. */
export function makeDate(year: number, month: number, day: number): string | null {
  const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isCalendarDate(date) ? date : null;
}
