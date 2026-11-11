import type { ReviewBullet } from './api.js';

export function ReviewPanel({
  bullets,
  onMigrate,
  selectedReviewIds,
  onToggleReviewLink,
}: {
  readonly bullets: readonly ReviewBullet[];
  readonly onMigrate: (bullet: ReviewBullet, mode: 'quick' | 'intentional') => void;
  readonly selectedReviewIds: ReadonlySet<string>;
  readonly onToggleReviewLink: (bullet: ReviewBullet) => void;
}) {
  return (
    <section
      aria-label="지난 미완료 검토"
      className="rounded-xl border border-amber-200 bg-amber-50/50 p-5"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-xl">지난 미완료 검토</h2>
        <span className="font-mono text-xs text-stone-500">자동 이월 없음</span>
      </div>
      {bullets.length ? (
        <ul className="mt-4 space-y-3">
          {bullets.map((bullet) => (
            <li
              className="rounded-lg border border-amber-100 bg-white p-3"
              key={`${bullet.date}-${bullet.id}`}
            >
              <p className="text-sm">□ {bullet.text}</p>
              <p className="mt-1 font-mono text-[11px] text-stone-400">{bullet.date}</p>
              <div className="mt-3 flex gap-2">
                <label className="flex items-center gap-1.5 text-xs text-stone-600">
                  <input
                    aria-label={`${bullet.text} 회고 링크`}
                    checked={selectedReviewIds.has(`${bullet.date}:${bullet.id}`)}
                    onChange={() => onToggleReviewLink(bullet)}
                    type="checkbox"
                  />
                  회고 링크
                </label>
                <button
                  aria-label={`${bullet.text} 간편 이월`}
                  className="rounded border border-stone-200 px-2 py-1 text-xs"
                  onClick={() => onMigrate(bullet, 'quick')}
                  type="button"
                >
                  간편 이월
                </button>
                <button
                  aria-label={`${bullet.text} 의식적 이월`}
                  className="rounded border border-stone-200 px-2 py-1 text-xs"
                  onClick={() => onMigrate(bullet, 'intentional')}
                  type="button"
                >
                  의식적 이월
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-stone-500">검토할 미완료 항목이 없습니다.</p>
      )}
    </section>
  );
}
