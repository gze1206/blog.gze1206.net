import { describe, expect, it } from 'vitest';

import { getEndedReviewPeriods, isCurrentOrPastReviewPeriod } from './period.js';
import { getReviewSuggestion } from './suggestion.js';

describe('review periods', () => {
  it('uses the configured app timezone at local month and ISO-week boundaries', () => {
    const monday = new Date('2026-08-03T00:30:00+09:00');
    expect(
      getEndedReviewPeriods(new Date('2026-08-01T00:30:00+09:00'), 'Asia/Seoul'),
    ).toMatchObject({
      monthly: { period: '2026-07', endedOn: '2026-07-31' },
    });
    expect(getEndedReviewPeriods(monday, 'Asia/Seoul')).toMatchObject({
      weekly: { period: '2026-W31', endedOn: '2026-08-02' },
    });
    expect(isCurrentOrPastReviewPeriod(monday, 'Asia/Seoul', 'weekly-review', '2026-W32')).toBe(
      true,
    );
    expect(isCurrentOrPastReviewPeriod(monday, 'Asia/Seoul', 'weekly-review', '2026-W33')).toBe(
      false,
    );
  });

  it('keeps the current ISO week open and returns the last fully ended week across a year boundary', () => {
    expect(getEndedReviewPeriods(new Date('2021-01-04T12:00:00.000Z'), 'UTC')).toEqual({
      weekly: { kind: 'weekly-review', period: '2020-W53', endedOn: '2021-01-03' },
      monthly: { kind: 'monthly-review', period: '2020-12', endedOn: '2020-12-31' },
    });
  });

  it('returns the real previous month at leap-day and year boundaries', () => {
    expect(getEndedReviewPeriods(new Date('2024-03-01T12:00:00.000Z'), 'UTC').monthly).toEqual({
      kind: 'monthly-review',
      period: '2024-02',
      endedOn: '2024-02-29',
    });
    expect(getEndedReviewPeriods(new Date('2026-01-01T12:00:00.000Z'), 'UTC').monthly.period).toBe(
      '2025-12',
    );
  });

  it('accepts only real current or past periods for manual creation', () => {
    const now = new Date('2026-08-12T12:00:00.000Z');

    expect(isCurrentOrPastReviewPeriod(now, 'UTC', 'weekly-review', '2026-W33')).toBe(true);
    expect(isCurrentOrPastReviewPeriod(now, 'UTC', 'weekly-review', '2020-W53')).toBe(true);
    expect(isCurrentOrPastReviewPeriod(now, 'UTC', 'weekly-review', '2026-W34')).toBe(false);
    expect(isCurrentOrPastReviewPeriod(now, 'UTC', 'weekly-review', '2026-W53')).toBe(false);
    expect(isCurrentOrPastReviewPeriod(now, 'UTC', 'monthly-review', '2026-08')).toBe(true);
    expect(isCurrentOrPastReviewPeriod(now, 'UTC', 'monthly-review', '2026-09')).toBe(false);
    expect(isCurrentOrPastReviewPeriod(now, 'UTC', 'monthly-review', '2026-13')).toBe(false);
  });
});

describe('getReviewSuggestion', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');

  it('returns only the most recently ended missing period and never mutates the document input', () => {
    const documents = [
      { kind: 'weekly-review' as const, period: '2026-W31' },
      { kind: 'monthly-review' as const, period: '2026-06' },
    ];
    const snapshot = structuredClone(documents);

    expect(getReviewSuggestion(now, 'UTC', documents)).toEqual({
      kind: 'weekly-review',
      period: '2026-W32',
      endedOn: '2026-08-09',
    });
    expect(documents).toEqual(snapshot);
  });

  it('falls back to the missing monthly review when the ended weekly review exists', () => {
    expect(
      getReviewSuggestion(now, 'UTC', [{ kind: 'weekly-review', period: '2026-W32' }]),
    ).toEqual({
      kind: 'monthly-review',
      period: '2026-07',
      endedOn: '2026-07-31',
    });
  });

  it('returns no suggestion when both ended periods already have matching reviews', () => {
    expect(
      getReviewSuggestion(now, 'UTC', [
        { kind: 'weekly-review', period: '2026-W32' },
        { kind: 'monthly-review', period: '2026-07' },
      ]),
    ).toBeNull();
  });

  it('does not mistake a current-period review for the ended-period review', () => {
    expect(
      getReviewSuggestion(now, 'UTC', [
        { kind: 'weekly-review', period: '2026-W33' },
        { kind: 'monthly-review', period: '2026-08' },
      ]),
    ).toMatchObject({ kind: 'weekly-review', period: '2026-W32' });
  });

  it('suppresses only an explicitly skipped period and may offer the other ended period', () => {
    expect(getReviewSuggestion(now, 'UTC', [], ['weekly-review:2026-W32'])).toEqual({
      kind: 'monthly-review',
      period: '2026-07',
      endedOn: '2026-07-31',
    });
  });

  it('prefers monthly when a week and month ended on the same day', () => {
    expect(getReviewSuggestion(new Date('2025-09-01T12:00:00.000Z'), 'UTC', [])).toEqual({
      kind: 'monthly-review',
      period: '2025-08',
      endedOn: '2025-08-31',
    });
  });
});
