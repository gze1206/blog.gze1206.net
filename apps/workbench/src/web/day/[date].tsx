import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';

import {
  captureBullet,
  changeBullet,
  migrateReviewBullet,
  readDay,
  reviewBullets,
  type Bullet,
  type BulletReference,
  type BulletType,
  type DocumentEntry,
  type ReviewBullet,
  type ReviewSuggestion,
} from '../api.js';
import { MigrateDialog } from '../MigrateDialog.js';
import { QuickCapture } from '../QuickCapture.js';
import { ReviewPanel } from '../ReviewPanel.js';
import { ReviewPrompt } from '../ReviewPrompt.js';

const glyph = (bullet: Bullet) =>
  bullet.status === 'completed'
    ? '▣'
    : bullet.status === 'cancelled'
      ? '⨯'
      : ({ memo: '•', note: '–', event: '○', task: '□' } as const)[bullet.type];

export function DayPage({
  date,
  onError,
  reviewSuggestion,
  onDismissReviewSuggestion,
  onCreateReview,
}: {
  readonly date: string;
  readonly onError: (message: string) => void;
  readonly reviewSuggestion: ReviewSuggestion | null;
  readonly onDismissReviewSuggestion: () => void;
  readonly onCreateReview: (
    suggestion: ReviewSuggestion,
    references: readonly BulletReference[],
  ) => Promise<DocumentEntry>;
}) {
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [review, setReview] = useState<ReviewBullet[]>([]);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(() => new Set());
  const [migration, setMigration] = useState<{
    readonly bullet: ReviewBullet;
    readonly mode: 'quick' | 'intentional';
  } | null>(null);

  const refresh = useCallback(async () => {
    const [day, older] = await Promise.all([readDay(date), reviewBullets(date)]);
    setBullets(day.bullets);
    setReview(older.bullets);
  }, [date]);

  useEffect(() => {
    let active = true;
    void Promise.all([readDay(date), reviewBullets(date)])
      .then(([day, older]) => {
        if (!active) return;
        setBullets(day.bullets);
        setReview(older.bullets);
        setLoadedDate(date);
      })
      .catch((error: unknown) => onError(toMessage(error)));
    return () => {
      active = false;
    };
  }, [date, onError]);

  const capture = async (type: BulletType, text: string) => {
    setBusy(true);
    try {
      await captureBullet(date, { type, text });
      await refresh();
    } catch (error) {
      onError(toMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const action = async (bullet: Bullet, event: KeyboardEvent<HTMLLIElement>) => {
    const requested =
      event.altKey && event.key === 'Enter'
        ? bullet.status === 'open'
          ? 'complete'
          : 'reopen'
        : event.altKey && event.key === 'Backspace'
          ? 'cancel'
          : event.altKey && event.key === 'ArrowRight'
            ? 'cycle-type'
            : null;
    if (!requested) return;
    event.preventDefault();
    try {
      await changeBullet(date, bullet.id, requested);
      await refresh();
    } catch (error) {
      onError(toMessage(error));
    }
  };
  const confirmMigration = async (confirmation?: string) => {
    if (!migration) return;
    try {
      await migrateReviewBullet({
        sourceId: migration.bullet.id,
        sourceDate: migration.bullet.date,
        targetDate: date,
        mode: migration.mode,
        ...(confirmation === undefined ? {} : { confirmation }),
      });
      setMigration(null);
      await refresh();
    } catch (error) {
      onError(toMessage(error));
    }
  };
  const toggleReviewLink = (bullet: { readonly date: string; readonly id: string }) => {
    const key = `${bullet.date}:${bullet.id}`;
    setSelectedReviewIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const createReview = async () => {
    if (!reviewSuggestion) return;
    const references = [...selectedReviewIds].map((key) => {
      const separator = key.indexOf(':');
      return { date: key.slice(0, separator), id: key.slice(separator + 1) };
    });
    setBusy(true);
    try {
      await onCreateReview(reviewSuggestion, references);
    } catch (error) {
      onError(toMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl overflow-y-auto px-8 py-10">
      <header className="mb-7">
        <p className="font-mono text-xs tracking-widest text-emerald-700 uppercase">Today</p>
        <h1 className="mt-1 font-serif text-3xl">{date} 일일 로그</h1>
      </header>
      {loadedDate === date && reviewSuggestion ? (
        <ReviewPrompt
          busy={busy}
          onCreate={() => void createReview()}
          onDismiss={onDismissReviewSuggestion}
          selectedBulletCount={selectedReviewIds.size}
          suggestion={reviewSuggestion}
        />
      ) : null}
      <QuickCapture busy={busy} onCapture={capture} />
      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-label="오늘 불렛" className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-serif text-xl">오늘의 불렛</h2>
          <ul className="mt-4 space-y-2" data-testid="day-bullets">
            {bullets.map((bullet) => (
              <li
                className="rounded-md px-3 py-2 outline-none focus:bg-emerald-50"
                id={`bullet-${bullet.id}`}
                key={bullet.id}
                onKeyDown={(event) => void action(bullet, event)}
                tabIndex={0}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>
                    <span className="mr-2">{glyph(bullet)}</span>
                    {bullet.text}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-stone-500">
                    <input
                      aria-label={`${bullet.text} 회고 링크`}
                      checked={selectedReviewIds.has(`${date}:${bullet.id}`)}
                      onChange={() => toggleReviewLink({ date, id: bullet.id })}
                      type="checkbox"
                    />
                    회고 링크
                  </label>
                </div>
              </li>
            ))}
          </ul>
          {!bullets.length ? (
            <p className="mt-3 text-sm text-stone-400">오늘 기록은 아직 비어 있습니다.</p>
          ) : null}
          <p className="mt-5 font-mono text-[11px] text-stone-400">
            Alt+Enter 완료 토글 · Alt+Backspace 취소 · Alt+→ 유형 순환
          </p>
        </section>
        <ReviewPanel
          bullets={review}
          onMigrate={(bullet, mode) => setMigration({ bullet, mode })}
          onToggleReviewLink={toggleReviewLink}
          selectedReviewIds={selectedReviewIds}
        />
      </div>
      {migration ? (
        <MigrateDialog
          bullet={migration.bullet}
          mode={migration.mode}
          onCancel={() => setMigration(null)}
          onConfirm={confirmMigration}
          targetDate={date}
        />
      ) : null}
    </div>
  );
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
}
