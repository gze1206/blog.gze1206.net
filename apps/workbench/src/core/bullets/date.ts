export function assertCalendarDate(value: string): void {
  const matched = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u.exec(value)?.groups;
  if (!matched) throw new Error('date must use a real Gregorian YYYY-MM-DD date');
  const year = Number(matched.year);
  const month = Number(matched.month);
  const day = Number(matched.day);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysByMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > (daysByMonth[month - 1] ?? 0)) {
    throw new Error('date must use a real Gregorian YYYY-MM-DD date');
  }
}

export function isCalendarDate(value: string): boolean {
  try {
    assertCalendarDate(value);
    return true;
  } catch {
    return false;
  }
}
