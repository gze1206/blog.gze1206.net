/** 일정 화면: 월 달력과 고른 날의 목록(NOR-243). */
import { useEffect, useMemo, useState } from 'react';

import { dayNumber } from '../../core/schedule/days.js';
import {
  createScheduleEvent,
  deleteScheduleEvent,
  listSchedule,
  readScheduleEvent,
  setScheduleCompletion,
  updateScheduleEvent,
  type Occurrence,
  type ScheduleEvent,
} from '../api.js';
import { EventDialog } from './EventDialog.js';
import {
  emptyForm,
  formFromEvent,
  formToInput,
  monthGrid,
  monthOf,
  shiftMonth,
  timeLabel,
  type EventForm,
} from './scheduleForm.js';

const WEEK_HEAD = ['일', '월', '화', '수', '목', '금', '토'];

type Dialog =
  | { readonly mode: 'new'; readonly form: EventForm }
  | {
      readonly mode: 'edit';
      readonly form: EventForm;
      readonly event: ScheduleEvent;
      readonly occurrenceDate: string;
    };

/** 회차가 걸친 날마다 묶는다. 여러 날 일정은 걸친 날 모두에 나온다. */
function byDay(occurrences: readonly Occurrence[]): Map<string, Occurrence[]> {
  const days = new Map<string, Occurrence[]>();
  for (const item of occurrences) {
    for (let day = dayNumber(item.date); day <= dayNumber(item.endDate); day += 1) {
      const key = new Date(day * 86_400_000).toISOString().slice(0, 10);
      days.set(key, [...(days.get(key) ?? []), item]);
    }
  }
  return days;
}

export function SchedulePage({
  today,
  initialDate,
  onError,
}: {
  readonly today: string;
  readonly initialDate: string;
  readonly onError: (message: string) => void;
}) {
  const [selected, setSelected] = useState(initialDate);
  const [month, setMonth] = useState(() => monthOf(initialDate));
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const grid = useMemo(() => monthGrid(month.year, month.month), [month]);
  const first = grid[0] ?? today;
  const last = grid[41] ?? today;

  /** 고치고 나면 올려서 다시 불러온다. */
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    listSchedule(first, last)
      .then((result) => {
        if (active) setOccurrences(result.occurrences);
      })
      .catch((error: unknown) =>
        onError(error instanceof Error ? error.message : '일정을 불러오지 못했습니다.'),
      );
    return () => {
      active = false;
    };
  }, [first, last, onError, version]);

  const days = useMemo(() => byDay(occurrences), [occurrences]);
  const selectedItems = days.get(selected) ?? [];
  const goMonth = (delta: number) =>
    setMonth((current) => shiftMonth(current.year, current.month, delta));
  const pick = (date: string) => {
    setSelected(date);
    const target = monthOf(date);
    if (target.year !== month.year || target.month !== month.month) setMonth(target);
  };
  const openItem = async (item: Occurrence) => {
    try {
      const event = await readScheduleEvent(item.eventId);
      setDialog({
        mode: 'edit',
        event,
        occurrenceDate: item.date,
        form: formFromEvent(event, item.date),
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : '일정을 열지 못했습니다.');
    }
  };
  const done = async (task: () => Promise<unknown>) => {
    try {
      await task();
      setDialog(null);
      setVersion((current) => current + 1);
    } catch (error) {
      onError(error instanceof Error ? error.message : '일정을 저장하지 못했습니다.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl overflow-y-auto px-4 py-6 md:px-8 md:py-10">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-accent uppercase">Schedule</p>
          <h1 className="mt-1 font-bold tracking-[-0.02em] text-2xl md:text-3xl">
            {month.year}년 {month.month}월
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="이전 달"
            className="min-h-10 min-w-10 rounded-md border border-border"
            onClick={() => goMonth(-1)}
            type="button"
          >
            ‹
          </button>
          <button
            className="min-h-10 rounded-md border border-border px-3 text-sm"
            onClick={() => pick(today)}
            type="button"
          >
            오늘
          </button>
          <button
            aria-label="다음 달"
            className="min-h-10 min-w-10 rounded-md border border-border"
            onClick={() => goMonth(1)}
            type="button"
          >
            ›
          </button>
          <button
            className="ml-2 min-h-10 rounded-md bg-foreground px-4 text-sm text-background"
            onClick={() => setDialog({ mode: 'new', form: emptyForm(selected) })}
            type="button"
          >
            새 일정
          </button>
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="min-w-0 rounded-xl border border-border bg-surface p-2 sm:p-3">
          <div aria-hidden="true" className="grid grid-cols-7 text-center text-[11px] text-muted">
            {WEEK_HEAD.map((label, index) => (
              <span className={`py-1 ${index === 0 ? 'text-danger' : ''}`} key={label}>
                {label}
              </span>
            ))}
          </div>
          <div aria-label="월 달력" className="grid grid-cols-7 gap-px" role="grid">
            {grid.map((date) => {
              const items = days.get(date) ?? [];
              const inMonth = monthOf(date).month === month.month;
              return (
                <button
                  aria-label={`${date}${items.length ? `, 일정 ${items.length}개` : ''}`}
                  aria-pressed={date === selected}
                  className={`flex min-h-12 min-w-0 flex-col items-stretch rounded-md p-1 text-left aria-pressed:bg-accent-soft md:min-h-24 ${
                    inMonth ? '' : 'opacity-45'
                  }`}
                  key={date}
                  onClick={() => pick(date)}
                  type="button"
                >
                  <span
                    className={`self-center text-xs md:self-start ${
                      date === today ? 'rounded-full bg-accent px-1.5 text-accent-foreground' : ''
                    }`}
                  >
                    {Number(date.slice(8))}
                  </span>
                  <span className="mt-1 flex justify-center gap-0.5 md:hidden">
                    {items.slice(0, 3).map((item) => (
                      <span
                        className="size-1.5 rounded-full bg-accent"
                        key={`${item.eventId}-${item.date}`}
                      />
                    ))}
                  </span>
                  <span className="mt-1 hidden min-w-0 flex-col gap-0.5 md:flex">
                    {items.slice(0, 2).map((item) => (
                      <span
                        className="truncate rounded bg-accent-soft px-1 text-[11px] text-foreground"
                        key={`${item.eventId}-${item.date}`}
                      >
                        {item.time ? `${item.time} ` : ''}
                        {item.title}
                      </span>
                    ))}
                    {items.length > 2 ? (
                      <span className="text-[10px] text-muted">+{items.length - 2}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section
          aria-label={`${selected} 일정`}
          className="min-w-0 rounded-xl border border-border bg-surface p-4"
        >
          <h2 className="font-bold tracking-[-0.02em] text-lg">{selected}</h2>
          {selectedItems.length ? (
            <ul className="mt-3 space-y-1">
              {selectedItems.map((item) => (
                <li className="flex items-start" key={`${item.eventId}-${item.date}`}>
                  <button
                    aria-label={`${item.title} ${item.completed ? '다시 열기' : '완료'}`}
                    className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md hover:bg-surface-sunken"
                    onClick={() =>
                      void done(() =>
                        setScheduleCompletion(item.eventId, item.date, !item.completed),
                      )
                    }
                    type="button"
                  >
                    {item.completed ? '◉' : '○'}
                  </button>
                  <button
                    className="flex min-h-10 w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-sunken"
                    onClick={() => void openItem(item)}
                    type="button"
                  >
                    <span className="w-20 shrink-0 font-mono text-xs text-muted">
                      {timeLabel(item)}
                    </span>
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      <span
                        className={`block text-sm ${item.completed ? 'text-muted line-through' : ''}`}
                      >
                        {item.title}
                        {item.recurring ? (
                          <span className="ml-1 text-muted" title="반복 일정">
                            ↻
                          </span>
                        ) : null}
                      </span>
                      {item.location ? (
                        <span className="block text-xs text-muted">{item.location}</span>
                      ) : null}
                      {item.endDate !== item.date ? (
                        <span className="block text-xs text-muted">
                          {item.date} ~ {item.endDate}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">일정이 없습니다.</p>
          )}
        </section>
      </div>
      {dialog ? (
        <EventDialog
          initial={dialog.form}
          mode={dialog.mode}
          onCancel={() => setDialog(null)}
          onDelete={
            dialog.mode === 'edit'
              ? (scope) =>
                  done(() => deleteScheduleEvent(dialog.event.id, scope, dialog.occurrenceDate))
              : undefined
          }
          onSave={(form, scope) =>
            done(async () => {
              const input = formToInput(form);
              if (dialog.mode === 'new') await createScheduleEvent(input);
              else await updateScheduleEvent(dialog.event.id, scope, dialog.occurrenceDate, input);
              pick(form.date);
            })
          }
          recurring={dialog.mode === 'edit' && dialog.event.repeat !== undefined}
        />
      ) : null}
    </div>
  );
}
