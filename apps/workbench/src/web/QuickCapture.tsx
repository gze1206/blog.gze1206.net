import { useState, type KeyboardEvent } from 'react';

import type { BulletType } from './api.js';

const choices: ReadonlyArray<{
  readonly type: BulletType;
  readonly glyph: string;
  readonly label: string;
}> = [
  { type: 'memo', glyph: '•', label: '메모' },
  { type: 'note', glyph: '–', label: '노트' },
  { type: 'event', glyph: '○', label: '일정' },
  { type: 'task', glyph: '□', label: '할 일' },
];

export function QuickCapture({
  busy,
  date,
  onCapture,
}: {
  readonly busy: boolean;
  /** 일정의 기본 날짜. 보고 있는 날이다(NOR-248). */
  readonly date: string;
  readonly onCapture: (
    type: BulletType,
    text: string,
    when?: { readonly date: string; readonly time: string },
  ) => Promise<void>;
}) {
  const [type, setType] = useState<BulletType>('memo');
  const [text, setText] = useState('');
  const [eventDate, setEventDate] = useState(date);
  const [eventTime, setEventTime] = useState('');

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (type === 'event') {
      await onCapture(type, trimmed, { date: eventDate || date, time: eventTime });
      setEventTime('');
    } else await onCapture(type, trimmed);
    setText('');
  };

  const keyboard = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey && /^Digit[1-4]$/u.test(event.code)) {
      event.preventDefault();
      setType(choices[Number(event.code.at(-1)) - 1]?.type ?? 'memo');
    } else if (event.key === 'Enter' && !event.altKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-4" aria-label="빠른 캡처">
      <div className="mb-3 flex gap-2" role="group" aria-label="불렛 유형">
        {choices.map((choice, index) => (
          <button
            aria-pressed={type === choice.type}
            className="rounded-md border border-border px-3 py-1.5 text-sm aria-pressed:border-accent aria-pressed:bg-accent-soft"
            key={choice.type}
            onClick={() => setType(choice.type)}
            title={`Alt+${index + 1}`}
            type="button"
          >
            {choice.glyph} {choice.label}
          </button>
        ))}
      </div>
      {type === 'event' ? (
        // 일정은 일정으로 들어간다. 날짜(기본: 보고 있는 날)와 시각(선택)을 고른다(NOR-248).
        <div className="mb-2 grid grid-cols-2 gap-2">
          <input
            aria-label="일정 날짜"
            className="field"
            onChange={(event) => setEventDate(event.target.value)}
            type="date"
            value={eventDate}
          />
          <input
            aria-label="일정 시각"
            className="field"
            onChange={(event) => setEventTime(event.target.value)}
            type="time"
            value={eventTime}
          />
        </div>
      ) : null}
      <div className="flex gap-2">
        <input
          aria-label="빠른 불렛 입력"
          className="field"
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={keyboard}
          placeholder="기록하고 Enter"
          value={text}
        />
        <button
          className="bg-foreground text-background shrink-0 rounded-md px-4 text-sm whitespace-nowrap"
          onClick={() => void submit()}
          type="button"
        >
          추가
        </button>
      </div>
    </section>
  );
}
