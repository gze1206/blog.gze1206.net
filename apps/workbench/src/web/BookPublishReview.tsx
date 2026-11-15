import type { BookPublishReviewData, PublishResult } from './api.js';
import { PublishHandoff } from './PublishHandoff.js';

export function BookPublishReview({
  review,
  cover,
  busy,
  result,
  onClose,
  onConfirm,
}: {
  readonly review: BookPublishReviewData;
  readonly cover: string;
  readonly busy: boolean;
  readonly result: PublishResult | null;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <section
      aria-label="책장 내보내기 검토"
      className="mt-5 rounded-lg border border-border bg-surface p-5 text-sm"
    >
      <h3 className="font-semibold">책장 내보내기 검토</h3>
      <p>종류: {review.kind === 'noop' ? '바뀐 것 없음' : review.kind}</p>
      <p>표지: {cover}</p>
      <p>{review.targetPath}</p>
      {review.warnings?.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
      <pre
        aria-label="책 통합 diff"
        className="mt-2 max-h-96 overflow-auto rounded-lg bg-foreground p-5 font-mono text-xs whitespace-pre text-background"
      >
        {review.diff}
      </pre>
      <div className="mt-3 flex gap-3">
        <button type="button" onClick={onClose}>
          닫기
        </button>
        <button
          className="rounded-md bg-foreground px-4 py-2 text-background disabled:bg-border-strong"
          type="button"
          disabled={review.kind === 'noop' || busy || result !== null}
          onClick={onConfirm}
        >
          확정
        </button>
      </div>
      {result ? (
        <div role="status">
          <PublishHandoff exportRef={result.exportRef} />
        </div>
      ) : null}
    </section>
  );
}
