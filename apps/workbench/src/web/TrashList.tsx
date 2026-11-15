import { useState } from 'react';

import { purgeTrash, restoreTrash, type TrashItem } from './api.js';

interface Props {
  readonly items: readonly TrashItem[];
  readonly onChanged: () => void;
  readonly onError: (message: string) => void;
}

/** 지운 문서 (NOR-205). 되돌리거나 영구히 지운다. */
export function TrashList({ items, onChanged, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
      onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : '휴지통을 고치지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="trash-title" className="border-border mt-6 border-t pt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="trash-title" className="text-muted text-xs font-semibold tracking-[0.18em]">
          휴지통
        </h2>
        <span className="text-muted text-xs">{items.length}</span>
      </div>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li className="rounded-md px-3 py-2" key={item.id}>
            <p className="text-body truncate text-sm">{item.title}</p>
            <p className="text-muted truncate font-mono text-[11px]">{item.relativePath}</p>
            <div className="mt-1 flex gap-2">
              <button
                className="text-accent text-xs hover:underline disabled:opacity-40"
                disabled={busy}
                onClick={() => void run(() => restoreTrash(item.id))}
                type="button"
              >
                복원
              </button>
              <button
                className="text-muted hover:text-danger text-xs disabled:opacity-40"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`"${item.title}" 을 영구히 지울까요? 되돌릴 수 없습니다.`))
                    void run(() => purgeTrash(item.id));
                }}
                type="button"
              >
                영구 삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
