import type { ReviewSuggestion } from './api.js';

const skippedKey = 'workbench.review.skipped';
const laterKey = 'workbench.review.later';

export function readSkippedReviewPeriods(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(skippedKey) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function rememberReviewLater(suggestion: ReviewSuggestion): void {
  try {
    localStorage.setItem(
      laterKey,
      JSON.stringify({
        kind: suggestion.kind,
        period: suggestion.period,
        deferredAt: new Date().toISOString(),
      }),
    );
  } catch {
    // The prompt still dismisses for this app session when browser storage is unavailable.
  }
}

export function skipReviewPeriod(suggestion: ReviewSuggestion): void {
  const key = `${suggestion.kind}:${suggestion.period}`;
  try {
    localStorage.setItem(
      skippedKey,
      JSON.stringify([...new Set([...readSkippedReviewPeriods(), key])]),
    );
  } catch {
    // The prompt still dismisses for this app session when browser storage is unavailable.
  }
}
