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

/** 좁은 화면에서도 손가락으로 누를 수 있는 크기(NOR-238 AC-4). 넓은 화면에서는 줄 높이에 맞춘다. */
const touchButton =
  'inline-flex min-h-10 min-w-10 items-center justify-center rounded-md hover:bg-surface-sunken md:min-h-7 md:min-w-7';

export function DayPage({
  date,
  isToday,
  onEditSource,
  onError,
  reviewSuggestion,
  onDismissReviewSuggestion,
  onCreateReview,
}: {
  readonly date: string;
  /** 머리글을 "Today" 로 쓸지(NOR-240). */
  readonly isToday: boolean;
  /** 그 날의 일지를 원본 편집기로 연다. 일지 문서가 없으면 버튼을 두지 않는다. */
  readonly onEditSource: (() => void) | undefined;
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
  type Change = 'complete' | 'cancel' | 'reopen' | 'cycle-type';
  /** 불렛 하나를 바꾼다. 지난 할 일은 그 할 일이 적힌 날짜의 기록을 고친다(NOR-238). */
  const change = async (bulletDate: string, id: string, requested: Change) => {
    try {
      await changeBullet(bulletDate, id, requested);
      await refresh();
    } catch (error) {
      onError(toMessage(error));
    }
  };
  const action = async (bullet: Bullet, event: KeyboardEvent<HTMLLIElement>) => {
    // 손가락으로 누르는 버튼(NOR-238)과 같은 일을 하는 단축키다. 버튼 안에서 누른 키는 버튼이 받는다.
    if (event.target !== event.currentTarget) return;
    const requested: Change | null =
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
    await change(date, bullet.id, requested);
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
    <div className="mx-auto w-full max-w-5xl overflow-y-auto px-4 py-6 md:px-8 md:py-10">
      <header className="mb-7 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            {isToday ? 'Today' : 'Daily log'}
          </p>
          <h1 className="mt-1 font-bold tracking-[-0.02em] text-2xl md:text-3xl">
            {date} 일일 로그
          </h1>
        </div>
        {onEditSource ? (
          <button
            className="min-h-10 shrink-0 rounded-md border border-border px-3 text-sm text-muted-strong hover:bg-surface-sunken md:min-h-0 md:py-1.5"
            onClick={onEditSource}
            type="button"
          >
            원본 편집
          </button>
        ) : null}
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
        <section aria-label="오늘 불렛" className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-bold tracking-[-0.02em] text-xl">
            {isToday ? '오늘의 불렛' : '이날의 불렛'}
          </h2>
          <ul className="mt-4 space-y-2" data-testid="day-bullets">
            {bullets.map((bullet) => (
              <li
                className="rounded-md px-3 py-2 outline-none focus:bg-accent-soft"
                id={`bullet-${bullet.id}`}
                key={bullet.id}
                onKeyDown={(event) => void action(bullet, event)}
                tabIndex={0}
              >
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-3">
                  <span className="flex min-w-0 items-center">
                    {bullet.type === 'task' ? (
                      <button
                        aria-label={`${bullet.text} ${bullet.status === 'open' ? '완료' : '다시 열기'}`}
                        className={touchButton}
                        onClick={() =>
                          void change(
                            date,
                            bullet.id,
                            bullet.status === 'open' ? 'complete' : 'reopen',
                          )
                        }
                        type="button"
                      >
                        {glyph(bullet)}
                      </button>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="inline-flex min-w-10 justify-center md:min-w-7"
                      >
                        {glyph(bullet)}
                      </span>
                    )}
                    <span className="min-w-0 [overflow-wrap:anywhere]">{bullet.text}</span>
                  </span>
                  <span className="flex items-center gap-1 pl-10 md:pl-0">
                    {bullet.type === 'task' && bullet.status === 'open' ? (
                      <button
                        aria-label={`${bullet.text} 취소`}
                        className={`${touchButton} text-xs text-muted`}
                        onClick={() => void change(date, bullet.id, 'cancel')}
                        title="취소 (Alt+Backspace)"
                        type="button"
                      >
                        취소
                      </button>
                    ) : null}
                    <button
                      aria-label={`${bullet.text} 유형 바꾸기`}
                      className={`${touchButton} text-xs text-muted`}
                      onClick={() => void change(date, bullet.id, 'cycle-type')}
                      title="유형 바꾸기 (Alt+→)"
                      type="button"
                    >
                      유형
                    </button>
                    <label className="ml-1 flex min-h-10 items-center gap-1.5 text-xs text-muted md:min-h-0">
                      <input
                        aria-label={`${bullet.text} 회고 링크`}
                        checked={selectedReviewIds.has(`${date}:${bullet.id}`)}
                        onChange={() => toggleReviewLink({ date, id: bullet.id })}
                        type="checkbox"
                      />
                      회고 링크
                    </label>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {!bullets.length ? (
            <p className="mt-3 text-sm text-muted">오늘 기록은 아직 비어 있습니다.</p>
          ) : null}
          <p className="mt-5 hidden font-mono text-[11px] text-muted md:block">
            Alt+Enter 완료 토글 · Alt+Backspace 취소 · Alt+→ 유형 순환
          </p>
        </section>
        <ReviewPanel
          bullets={review}
          onChange={(bullet, requested) => void change(bullet.date, bullet.id, requested)}
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
