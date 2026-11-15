import type { ReviewSuggestion } from './api.js';
import { rememberReviewLater, skipReviewPeriod } from './reviewPreferences.js';

interface Props {
  readonly suggestion: ReviewSuggestion;
  readonly selectedBulletCount: number;
  readonly busy: boolean;
  readonly onCreate: () => void;
  readonly onDismiss: () => void;
}

export function ReviewPrompt({
  suggestion,
  selectedBulletCount,
  busy,
  onCreate,
  onDismiss,
}: Props) {
  const frequency = suggestion.kind === 'weekly-review' ? '주간' : '월간';
  return (
    <section
      aria-label="회고 제안"
      className="mb-6 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {suggestion.period} {frequency} 회고를 남길까요?
          </p>
          <p className="mt-0.5 text-xs text-muted">
            종료일 {suggestion.endedOn}
            {selectedBulletCount > 0 ? ` · 선택 불렛 ${selectedBulletCount}개 연결` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded bg-accent-strong px-3 py-1.5 text-xs text-accent-foreground disabled:opacity-50"
            disabled={busy}
            onClick={onCreate}
            type="button"
          >
            작성
          </button>
          <button
            className="rounded border border-border bg-surface px-3 py-1.5 text-xs"
            onClick={() => {
              rememberReviewLater(suggestion);
              onDismiss();
            }}
            type="button"
          >
            나중에
          </button>
          <button
            className="rounded px-3 py-1.5 text-xs text-muted"
            onClick={() => {
              skipReviewPeriod(suggestion);
              onDismiss();
            }}
            type="button"
          >
            건너뛰기
          </button>
        </div>
      </div>
    </section>
  );
}
