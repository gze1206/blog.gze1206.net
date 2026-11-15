import { useState } from 'react';

import type { ReviewBullet } from './api.js';

export function MigrateDialog({
  bullet,
  mode,
  targetDate,
  onCancel,
  onConfirm,
}: {
  readonly bullet: ReviewBullet;
  readonly mode: 'quick' | 'intentional';
  readonly targetDate: string;
  readonly onCancel: () => void;
  readonly onConfirm: (confirmation?: string) => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const intentional = mode === 'intentional';
  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(intentional ? confirmation : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-stone-950/30 p-6">
      <section
        aria-label={intentional ? '의식적 이월' : '간편 이월'}
        aria-modal="true"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        role="dialog"
      >
        <h2 className="font-serif text-2xl">{intentional ? '의식적 이월' : '간편 이월'}</h2>
        <p className="mt-3 text-sm text-stone-600">{bullet.text}</p>
        <label className="mt-5 block text-sm font-medium">
          대상 날짜
          <input className="field mt-1" readOnly type="date" value={targetDate} />
        </label>
        {intentional ? (
          <label className="mt-4 block text-sm font-medium">
            확인 문구
            <input
              className="field mt-1"
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="오늘도 이 일을 선택합니다"
              value={confirmation}
            />
          </label>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button className="rounded-md px-4 py-2 text-sm" onClick={onCancel} type="button">
            취소
          </button>
          <button
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-40"
            disabled={busy || (intentional && !confirmation.trim())}
            onClick={() => void submit()}
            type="button"
          >
            이월 확인
          </button>
        </div>
      </section>
    </div>
  );
}
