import { useState } from 'react';

import type { PublishResult, PublishReviewData } from './api.js';
import { PublishHandoff } from './PublishHandoff.js';
import { DiffView } from './diff/DiffView.js';

interface Props {
  readonly review: PublishReviewData;
  readonly publishing: boolean;
  readonly result: PublishResult | null;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

export function PublishReview({ review, publishing, result, onClose, onConfirm }: Props) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <section
      aria-labelledby="publish-review-title"
      className="min-h-0 flex-1 overflow-y-auto px-8 py-7"
    >
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between gap-8">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">
              Dry run · no Git changes
            </p>
            <h2 id="publish-review-title" className="mt-1 font-serif text-3xl">
              공개 발행 검토
            </h2>
          </div>
          <button className="text-sm text-muted hover:text-foreground" onClick={onClose}>
            편집기로 돌아가기
          </button>
        </header>

        <dl className="mt-7 grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-5 text-sm">
          <dt className="text-muted">제목</dt>
          <dd>{review.metadata.title}</dd>
          <dt className="text-muted">slug</dt>
          <dd className="font-mono">{review.metadata.slug}</dd>
          <dt className="text-muted">카테고리 / 태그</dt>
          <dd>
            {review.metadata.category} · {review.metadata.tags.join(', ')}
          </dd>
          <dt className="text-muted">발행 / 수정일</dt>
          <dd>
            {review.metadata.publishedAt} / {review.metadata.updatedAt}
          </dd>
          <dt className="text-muted">대상</dt>
          <dd className="font-mono">{review.targetPath}</dd>
          <dt className="text-muted">자산</dt>
          <dd>{review.assets.length === 0 ? '없음' : review.assets.join(', ')}</dd>
        </dl>

        {(review.quotes ?? []).length > 0 ? (
          <section className="mt-7 text-sm">
            <h3 className="font-semibold text-body">인용 목록</h3>
            <ul>
              {review.quotes?.map((quote, index) => (
                <li key={index}>
                  {quote.book} · {[...quote.excerpt].slice(0, 40).join('')} · {quote.length}자 · 책
                  누적 {quote.bookPublicTotal}자
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <h3 className="mt-7 text-sm font-semibold text-body">통합 diff</h3>
        {(review.warnings ?? []).map((warning) => (
          <p key={warning} role="alert">
            {warning}
          </p>
        ))}
        <DiffView diff={review.diff} label="통합 diff" />

        <footer className="mt-5 flex items-center justify-between gap-5 rounded-lg border border-notice-foreground/30 bg-notice p-4">
          <label className="flex items-start gap-3 text-sm leading-5 text-body">
            <input
              checked={confirmed}
              className="mt-1"
              disabled={publishing || result !== null}
              onChange={(event) => setConfirmed(event.target.checked)}
              type="checkbox"
            />
            검토 내용을 확인했습니다
          </label>
          <button
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:bg-border-strong"
            disabled={!confirmed || publishing || result !== null}
            onClick={onConfirm}
            type="button"
          >
            {publishing ? '발행 중…' : '발행'}
          </button>
        </footer>
        {result ? (
          <section
            className="mt-4 rounded-lg border border-accent/40 bg-accent-soft p-4 text-sm text-accent-strong"
            role="status"
          >
            <PublishHandoff exportRef={result.exportRef} />
          </section>
        ) : null}
      </div>
    </section>
  );
}
