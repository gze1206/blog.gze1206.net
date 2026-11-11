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
  onCapture,
}: {
  readonly busy: boolean;
  readonly onCapture: (type: BulletType, text: string) => Promise<void>;
}) {
  const [type, setType] = useState<BulletType>('memo');
  const [text, setText] = useState('');

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    await onCapture(type, trimmed);
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
    <section className="rounded-xl border border-stone-200 bg-white p-4" aria-label="빠른 캡처">
      <div className="mb-3 flex gap-2" role="group" aria-label="불렛 유형">
        {choices.map((choice, index) => (
          <button
            aria-pressed={type === choice.type}
            className="rounded-md border border-stone-200 px-3 py-1.5 text-sm aria-pressed:border-emerald-600 aria-pressed:bg-emerald-50"
            key={choice.type}
            onClick={() => setType(choice.type)}
            title={`Alt+${index + 1}`}
            type="button"
          >
            {choice.glyph} {choice.label}
          </button>
        ))}
      </div>
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
          className="rounded-md bg-stone-900 px-4 text-sm text-white"
          onClick={() => void submit()}
          type="button"
        >
          추가
        </button>
      </div>
    </section>
  );
}
