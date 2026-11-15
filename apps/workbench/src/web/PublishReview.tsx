import { useState } from 'react';

import type { PublishResult, PublishReviewData } from './api.js';

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
            <p className="font-mono text-[11px] tracking-[0.18em] text-emerald-700 uppercase">
              Dry run · no Git changes
            </p>
            <h2 id="publish-review-title" className="mt-1 font-serif text-3xl">
              공개 발행 검토
            </h2>
          </div>
          <button className="text-sm text-stone-500 hover:text-stone-900" onClick={onClose}>
            편집기로 돌아가기
          </button>
        </header>

        <dl className="mt-7 grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 rounded-lg border border-stone-200 bg-white p-5 text-sm">
          <dt className="text-stone-500">제목</dt>
          <dd>{review.metadata.title}</dd>
          <dt className="text-stone-500">slug</dt>
          <dd className="font-mono">{review.metadata.slug}</dd>
          <dt className="text-stone-500">카테고리 / 태그</dt>
          <dd>
            {review.metadata.category} · {review.metadata.tags.join(', ')}
          </dd>
          <dt className="text-stone-500">발행 / 수정일</dt>
          <dd>
            {review.metadata.publishedAt} / {review.metadata.updatedAt}
          </dd>
          <dt className="text-stone-500">대상</dt>
          <dd className="font-mono">{review.targetPath}</dd>
          <dt className="text-stone-500">자산</dt>
          <dd>{review.assets.length === 0 ? '없음' : review.assets.join(', ')}</dd>
        </dl>

        {(review.quotes ?? []).length > 0 ? (
          <section className="mt-7 text-sm">
            <h3 className="font-semibold text-stone-700">인용 목록</h3>
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
        <h3 className="mt-7 text-sm font-semibold text-stone-700">통합 diff</h3>
        {(review.warnings ?? []).map((warning) => (
          <p key={warning} role="alert">
            {warning}
          </p>
        ))}
        <pre
          aria-label="통합 diff"
          className="mt-2 max-h-[28rem] overflow-auto rounded-lg bg-stone-950 p-5 font-mono text-xs leading-5 whitespace-pre text-stone-100"
        >
          {review.diff}
        </pre>

        <footer className="mt-5 flex items-center justify-between gap-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <label className="flex items-start gap-3 text-sm leading-5 text-stone-700">
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
            className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:bg-stone-300"
            disabled={!confirmed || publishing || result !== null}
            onClick={onConfirm}
            type="button"
          >
            {publishing ? '산출물 생성 중…' : 'outbox 산출물 생성'}
          </button>
        </footer>
        {result ? (
          <section
            className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
            role="status"
          >
            <p>
              outbox에 <code className="font-mono">{result.exportRef}</code> 산출물이
              준비되었습니다. 앱은 push하지 않았습니다.
            </p>
            <p className="mt-2">
              push 전 전체 clone에서 최신 상태를 받은 뒤 base 정합성을 확인하세요.
            </p>
            <pre className="mt-2 overflow-auto rounded bg-white/70 p-3 font-mono text-xs whitespace-pre-wrap">{`git fetch origin\ngit merge-base --is-ancestor ${result.baseSha} origin/main`}</pre>
            {result.exportFormat === 'bundle' ? (
              <pre className="mt-2 overflow-auto rounded bg-white/70 p-3 font-mono text-xs whitespace-pre-wrap">{`git bundle verify ${result.exportRef}\ngit fetch ${result.exportRef} ${result.branch}:${result.branch}`}</pre>
            ) : (
              <pre className="mt-2 overflow-auto rounded bg-white/70 p-3 font-mono text-xs whitespace-pre-wrap">{`git switch -c ${result.branch} ${result.baseSha}\ngit am ${result.exportRef}`}</pre>
            )}
          </section>
        ) : null}
      </div>
    </section>
  );
}
