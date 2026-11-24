/** 일정 만들기·고치기 대화 상자(NOR-243). */
import { useState } from 'react';

import { WEEKDAYS, type Weekday } from '../../core/schedule/event.js';
import type { ScheduleScope } from '../api.js';
import type { EventForm } from './scheduleForm.js';

const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
};

const SCOPES: readonly { value: ScheduleScope; label: string }[] = [
  { value: 'this', label: '이 일정만' },
  { value: 'following', label: '이후 모든 일정' },
  { value: 'all', label: '모든 일정' },
];

const button = 'min-h-10 rounded-md px-4 text-sm md:min-h-9';

export function EventDialog({
  mode,
  initial,
  recurring,
  onCancel,
  onSave,
  onDelete,
}: {
  readonly mode: 'new' | 'edit';
  readonly initial: EventForm;
  /** 고치는 일정이 반복 일정이면 저장·삭제 전에 범위를 묻는다. */
  readonly recurring: boolean;
  readonly onCancel: () => void;
  readonly onSave: (form: EventForm, scope: ScheduleScope) => Promise<void>;
  readonly onDelete: ((scope: ScheduleScope) => Promise<void>) | undefined;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<'save' | 'delete' | null>(null);
  const [scope, setScope] = useState<ScheduleScope>('this');
  const set = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    if (mode === 'edit' && recurring) setAsking('save');
    else void run(() => onSave(form, 'all'));
  };
  const remove = () => {
    if (!onDelete) return;
    if (recurring) setAsking('delete');
    else if (window.confirm(`"${form.title}" 일정을 지울까요?`)) void run(() => onDelete('all'));
  };
  const confirmScope = () =>
    void run(async () => {
      if (asking === 'save') await onSave(form, scope);
      else if (asking === 'delete' && onDelete) await onDelete(scope);
      setAsking(null);
    });

  const title = mode === 'new' ? '새 일정' : '일정 고치기';
  // 휴대폰에서는 대화 상자가 화면보다 길다. 가운데 맞추면 위가 잘리므로 위에서부터 놓고 스크롤한다.
  return (
    <div className="fixed inset-0 z-30 grid items-start justify-items-center overflow-y-auto bg-scrim p-3 sm:items-center sm:p-6">
      <section
        aria-label={title}
        aria-modal="true"
        className="w-full max-w-lg rounded-xl bg-surface p-5 shadow-xl sm:p-6"
        role="dialog"
      >
        <h2 className="font-bold tracking-[-0.02em] text-xl">{title}</h2>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label className="block text-sm font-medium">
            제목
            <input
              className="field mt-1"
              onChange={(event) => set('title', event.target.value)}
              required
              value={form.title}
            />
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              checked={form.allDay}
              onChange={(event) => set('allDay', event.target.checked)}
              type="checkbox"
            />
            종일
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-sm font-medium">
              날짜
              <input
                className="field mt-1"
                onChange={(event) => set('date', event.target.value)}
                required
                type="date"
                value={form.date}
              />
            </label>
            <label className="block min-w-0 text-sm font-medium">
              끝 날짜(여러 날)
              <input
                className="field mt-1"
                min={form.date}
                onChange={(event) => set('endDate', event.target.value)}
                type="date"
                value={form.endDate}
              />
            </label>
          </div>
          {form.allDay ? null : (
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0 text-sm font-medium">
                시작 시각
                <input
                  className="field mt-1"
                  onChange={(event) => set('time', event.target.value)}
                  type="time"
                  value={form.time}
                />
              </label>
              <label className="block min-w-0 text-sm font-medium">
                끝 시각
                <input
                  className="field mt-1"
                  onChange={(event) => set('endTime', event.target.value)}
                  type="time"
                  value={form.endTime}
                />
              </label>
            </div>
          )}
          <label className="block text-sm font-medium">
            장소
            <input
              className="field mt-1"
              onChange={(event) => set('location', event.target.value)}
              value={form.location}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0 text-sm font-medium">
              반복
              <select
                className="field mt-1"
                onChange={(event) => set('repeat', event.target.value as EventForm['repeat'])}
                value={form.repeat}
              >
                <option value="none">안 함</option>
                <option value="daily">매일</option>
                <option value="weekly">매주</option>
                <option value="monthly">매월</option>
                <option value="yearly">매년</option>
              </select>
            </label>
            {form.repeat === 'none' ? null : (
              <label className="block min-w-0 text-sm font-medium">
                간격
                <input
                  className="field mt-1"
                  inputMode="numeric"
                  min={1}
                  onChange={(event) => set('interval', event.target.value)}
                  type="number"
                  value={form.interval}
                />
              </label>
            )}
          </div>
          {form.repeat === 'weekly' ? (
            <fieldset className="flex flex-wrap gap-1" aria-label="요일">
              {WEEKDAYS.map((day) => {
                const on = form.weekdays.includes(day);
                return (
                  <button
                    aria-pressed={on}
                    className="min-h-10 min-w-10 rounded-md border border-border text-sm aria-pressed:border-accent aria-pressed:bg-accent-soft"
                    key={day}
                    onClick={() =>
                      set(
                        'weekdays',
                        on ? form.weekdays.filter((item) => item !== day) : [...form.weekdays, day],
                      )
                    }
                    type="button"
                  >
                    {WEEKDAY_LABEL[day]}
                  </button>
                );
              })}
            </fieldset>
          ) : null}
          {form.repeat === 'none' ? null : (
            <div className="grid grid-cols-2 gap-3">
              <label className="block min-w-0 text-sm font-medium">
                끝내기
                <select
                  className="field mt-1"
                  onChange={(event) => set('ends', event.target.value as EventForm['ends'])}
                  value={form.ends}
                >
                  <option value="never">계속</option>
                  <option value="until">날짜까지</option>
                  <option value="count">횟수만큼</option>
                </select>
              </label>
              {form.ends === 'until' ? (
                <label className="block min-w-0 text-sm font-medium">
                  끝내는 날
                  <input
                    className="field mt-1"
                    min={form.date}
                    onChange={(event) => set('until', event.target.value)}
                    type="date"
                    value={form.until}
                  />
                </label>
              ) : form.ends === 'count' ? (
                <label className="block min-w-0 text-sm font-medium">
                  횟수
                  <input
                    className="field mt-1"
                    inputMode="numeric"
                    min={1}
                    onChange={(event) => set('count', event.target.value)}
                    type="number"
                    value={form.count}
                  />
                </label>
              ) : null}
            </div>
          )}
          <label className="block text-sm font-medium">
            메모
            <textarea
              className="field mt-1 min-h-20"
              onChange={(event) => set('notes', event.target.value)}
              value={form.notes}
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {onDelete ? (
              <button
                className={`${button} text-danger hover:bg-danger/10`}
                disabled={busy}
                onClick={remove}
                type="button"
              >
                삭제
              </button>
            ) : (
              <span />
            )}
            <span className="flex gap-2">
              <button className={button} onClick={onCancel} type="button">
                취소
              </button>
              <button
                className={`${button} bg-foreground text-background`}
                disabled={busy || form.title.trim() === ''}
                type="submit"
              >
                저장
              </button>
            </span>
          </div>
        </form>
      </section>
      {asking ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-scrim p-3">
          <section
            aria-label={asking === 'save' ? '반복 일정 고치기' : '반복 일정 지우기'}
            aria-modal="true"
            className="w-full max-w-sm rounded-xl bg-surface p-5 shadow-xl"
            role="dialog"
          >
            <h3 className="font-bold text-lg">
              {asking === 'save' ? '반복 일정 고치기' : '반복 일정 지우기'}
            </h3>
            <div className="mt-3 grid gap-1">
              {SCOPES.map((item) => (
                <label className="flex min-h-10 items-center gap-2 text-sm" key={item.value}>
                  <input
                    checked={scope === item.value}
                    name="schedule-scope"
                    onChange={() => setScope(item.value)}
                    type="radio"
                  />
                  {item.label}
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={button} onClick={() => setAsking(null)} type="button">
                취소
              </button>
              <button
                className={`${button} bg-foreground text-background`}
                disabled={busy}
                onClick={confirmScope}
                type="button"
              >
                확인
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
