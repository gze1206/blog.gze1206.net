import { useState } from 'react';

import {
  addBookListItem,
  deleteBookListItem,
  updateBookListItem,
  type BookListItem,
  type BookListName,
} from './api.js';

interface Props {
  readonly documentId: string;
  readonly bookId?: string;
  readonly list: BookListName;
  readonly items: readonly BookListItem[];
  readonly onChanged: () => void;
  readonly onError: (message: string) => void;
}

/** 목록마다 부르는 이름과 안내가 다르다. 담기는 것이 다르기 때문이다. */
const LABELS = {
  excerpts: {
    title: '구절',
    add: '구절 남기기',
    empty: '아직 옮겨 적은 구절이 없습니다.',
    text: '옮긴 문장 (책에 있는 그대로)',
    memo: '이 구절에 대한 메모',
    memoHint: '이 문장을 두고 든 생각. 책 전체에 대한 것은 옆의 독서 메모로.',
  },
  memos: {
    title: '독서 메모',
    add: '메모 남기기',
    empty: '아직 남긴 메모가 없습니다.',
    text: '읽으면서 든 생각',
    memo: null,
    memoHint: null,
  },
} as const;

/**
 * 구절과 독서 메모 (NOR-189).
 *
 * 둘은 담기는 것이 다를 뿐 다루는 법이 같아 한 부품으로 그린다. 구절에만 딸린 메모 칸이 있다 —
 * 그 메모는 **그 문장**에 대한 것이고, 책 전체를 향한 생각은 독서 메모로, 다 읽고 쓰는 글은
 * 독서 노트(문서 본문)로 간다.
 */
export function BookNotes({ documentId, bookId, list, items, onChanged, onError }: Props) {
  const labels = LABELS[list];
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [page, setPage] = useState('');
  const [text, setText] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [publicOverrides, setPublicOverrides] = useState<Record<number, boolean>>({});

  const open = (target: number | 'new') => {
    const current = target === 'new' ? undefined : items[target];
    setPage(current?.page === undefined ? '' : String(current.page));
    setText(current?.text ?? '');
    setMemo(current?.memo ?? '');
    setEditing(target);
  };

  const submit = async () => {
    if (editing === null) return;
    setBusy(true);
    try {
      const pageNumber = Number.parseInt(page, 10);
      const item: BookListItem = {
        text: text.trim(),
        ...(Number.isFinite(pageNumber) && pageNumber > 0 ? { page: pageNumber } : {}),
        ...(labels.memo !== null && memo.trim() !== '' ? { memo: memo.trim() } : {}),
      };
      if (editing === 'new') await addBookListItem(documentId, list, item);
      else await updateBookListItem(documentId, list, editing, item);
      setEditing(null);
      onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : '남기지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (index: number, item: BookListItem, value: boolean) => {
    setBusy(true);
    setPublicOverrides((current) => ({ ...current, [index]: value }));
    try {
      await updateBookListItem(documentId, 'excerpts', index, {
        text: item.text,
        ...(item.page === undefined ? {} : { page: item.page }),
        ...(item.memo === undefined ? {} : { memo: item.memo }),
        public: value,
      });
      onChanged();
    } catch (caught) {
      setPublicOverrides((current) => ({ ...current, [index]: item.public === true }));
      onError(caught instanceof Error ? caught.message : '공개 상태를 바꾸지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (index: number) => {
    setBusy(true);
    try {
      await deleteBookListItem(documentId, list, index);
      setEditing(null);
      setPublicOverrides({});
      onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : '지우지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`${list}-title`} className="min-h-0 flex-1">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-sm" id={`${list}-title`}>
          {labels.title}{' '}
          <span className="ml-1 font-mono text-xs text-stone-400">{items.length}</span>
        </h3>
        <button
          className="text-xs text-emerald-700"
          onClick={() => (editing === 'new' ? setEditing(null) : open('new'))}
          type="button"
        >
          {editing === 'new' ? '접기' : labels.add}
        </button>
      </div>

      {editing === 'new' ? (
        <Form
          busy={busy}
          labels={labels}
          memo={memo}
          onCancel={() => setEditing(null)}
          onMemo={setMemo}
          onPage={setPage}
          onSubmit={() => void submit()}
          onText={setText}
          page={page}
          text={text}
        />
      ) : null}

      <ol className="mt-3 grid gap-3">
        {items.length === 0 ? (
          <p className="text-sm text-stone-400">{labels.empty}</p>
        ) : (
          items.map((item, index) => (
            <li className="border-l-2 border-stone-300 pl-3" key={`${item.text}:${index}`}>
              {editing === index ? (
                <Form
                  busy={busy}
                  labels={labels}
                  memo={memo}
                  onCancel={() => setEditing(null)}
                  onMemo={setMemo}
                  onPage={setPage}
                  onSubmit={() => void submit()}
                  onText={setText}
                  page={page}
                  text={text}
                />
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap text-stone-800">{item.text}</p>
                  {list === 'excerpts' ? (
                    <div className="mt-1 flex gap-3 text-sm text-stone-600">
                      <label>
                        <input
                          type="checkbox"
                          checked={publicOverrides[index] ?? item.public === true}
                          aria-disabled={busy}
                          onChange={(event) => {
                            if (!busy) void toggle(index, item, event.target.checked);
                          }}
                        />{' '}
                        공개
                      </label>
                      {(publicOverrides[index] ?? item.public === true) &&
                      item.id !== undefined &&
                      bookId !== undefined ? (
                        <button
                          type="button"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(`{% bookquote book="${bookId}" excerpt="${item.id}" /%}`)
                              .catch(() => onError('복사하지 못했습니다.'))
                          }
                        >
                          인용 복사
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {item.memo === undefined ? null : (
                    <p className="mt-1 text-sm whitespace-pre-wrap text-stone-600">— {item.memo}</p>
                  )}
                  <p className="mt-1 flex items-center gap-2 font-mono text-[11px] text-stone-400">
                    <span>{item.page === undefined ? '쪽 모름' : `p.${item.page}`}</span>
                    <button
                      className="hover:text-stone-700"
                      onClick={() => open(index)}
                      type="button"
                    >
                      고치기
                    </button>
                    <button
                      className="hover:text-red-700"
                      disabled={busy}
                      onClick={() => void remove(index)}
                      type="button"
                    >
                      지우기
                    </button>
                  </p>
                </>
              )}
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

function Form({
  labels,
  page,
  text,
  memo,
  busy,
  onPage,
  onText,
  onMemo,
  onSubmit,
  onCancel,
}: {
  readonly labels: (typeof LABELS)[BookListName];
  readonly page: string;
  readonly text: string;
  readonly memo: string;
  readonly busy: boolean;
  readonly onPage: (value: string) => void;
  readonly onText: (value: string) => void;
  readonly onMemo: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <div className="mt-2 grid gap-2 rounded-lg border border-stone-200 bg-white p-3">
      <label className="block">
        <span className="block text-xs text-stone-500">쪽 (모르면 비워 두세요)</span>
        <input
          className="mt-1 w-24 rounded border border-stone-300 px-2 py-1 font-mono text-sm"
          inputMode="numeric"
          onChange={(event) => onPage(event.target.value)}
          value={page}
        />
      </label>
      <label className="block">
        <span className="block text-xs text-stone-500">{labels.text}</span>
        <textarea
          className="mt-1 h-20 w-full rounded border border-stone-300 px-2 py-1 text-sm"
          onChange={(event) => onText(event.target.value)}
          value={text}
        />
      </label>
      {labels.memo === null ? null : (
        <label className="block">
          <span className="block text-xs text-stone-500">{labels.memo}</span>
          <textarea
            className="mt-1 h-16 w-full rounded border border-stone-300 px-2 py-1 text-sm"
            onChange={(event) => onMemo(event.target.value)}
            placeholder={labels.memoHint ?? ''}
            value={memo}
          />
        </label>
      )}
      <div className="flex justify-end gap-2">
        <button className="px-2 py-1 text-sm text-stone-600" onClick={onCancel} type="button">
          취소
        </button>
        <button
          className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          disabled={busy || text.trim() === ''}
          onClick={onSubmit}
          type="button"
        >
          남기기
        </button>
      </div>
    </div>
  );
}
