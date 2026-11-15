import { getEndedReviewPeriods, type EndedReviewPeriod, type ReviewKind } from './period.js';

export interface ReviewDocument {
  readonly kind: ReviewKind;
  readonly period: string;
}

export function getReviewSuggestion(
  now: Date,
  timeZone: string,
  documents: readonly ReviewDocument[],
  suppressed: readonly string[] = [],
): EndedReviewPeriod | null {
  const periods = getEndedReviewPeriods(now, timeZone);
  const completed = new Set(documents.map(({ kind, period }) => reviewPeriodKey(kind, period)));
  const suppressedKeys = new Set(suppressed);

  return (
    [periods.weekly, periods.monthly]
      .filter(({ kind, period }) => {
        const key = reviewPeriodKey(kind, period);
        return !completed.has(key) && !suppressedKeys.has(key);
      })
      .sort(
        (left, right) =>
          right.endedOn.localeCompare(left.endedOn) ||
          Number(right.kind === 'monthly-review') - Number(left.kind === 'monthly-review'),
      )[0] ?? null
  );
}

export function reviewPeriodKey(kind: ReviewKind, period: string): string {
  return `${kind}:${period}`;
}
