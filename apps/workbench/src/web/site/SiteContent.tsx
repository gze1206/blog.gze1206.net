import { useEffect, useState } from 'react';

import {
  confirmSite,
  listSite,
  reviewSite,
  type PublishResult,
  type SiteChangeInput,
  type SiteCollection,
  type SiteEntryData,
  type SiteReviewData,
} from '../api.js';
import { PublishHandoff } from '../PublishHandoff.js';
import {
  SITE_FIELDS,
  applyFormValue,
  emptyRow,
  newSiteData,
  toFormValue,
  type Row,
  type SiteField,
} from './siteForm.js';

const COLLECTIONS: readonly { id: SiteCollection; label: string }[] = [
  { id: 'profile', label: '프로필' },
  { id: 'experience', label: '경력' },
  { id: 'portfolio', label: '포트폴리오' },
  { id: 'series', label: '시리즈' },
];

type Data = Readonly<Record<string, unknown>>;

function entryTitle(entry: SiteEntryData): string {
  for (const key of ['name', 'title', 'organization']) {
    const value = entry.data[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return entry.id;
}

export function SiteList({
  entries,
  selected,
  onSelect,
  onCreate,
}: {
  readonly entries: readonly SiteEntryData[];
  readonly selected: { readonly collection: SiteCollection; readonly id: string } | null;
  readonly onSelect: (entry: SiteEntryData) => void;
  readonly onCreate: (collection: SiteCollection) => void;
}) {
  return (
    <nav aria-label="사이트 콘텐츠 목록" className="space-y-5">
      {COLLECTIONS.map((collection) => (
        <div key={collection.id}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
              {collection.label}
            </h3>
            {collection.id === 'profile' ? null : (
              <button
                aria-label={`새 ${collection.label}`}
                className="rounded px-2 text-sm text-muted hover:text-foreground"
                onClick={() => onCreate(collection.id)}
                type="button"
              >
                +
              </button>
            )}
          </div>
          <ul className="mt-2 space-y-1">
            {entries
              .filter((entry) => entry.collection === collection.id)
              .map((entry) => (
                <li key={entry.id}>
                  <button
                    aria-current={
                      selected?.collection === entry.collection && selected.id === entry.id
                        ? 'true'
                        : undefined
                    }
                    className="w-full rounded-md px-3 py-1.5 text-left text-sm aria-[current=true]:bg-surface"
                    onClick={() => onSelect(entry)}
                    type="button"
                  >
                    {entryTitle(entry)}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const inputClass =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground';

export function SiteForm({
  collection,
  data,
  onChange,
}: {
  readonly collection: SiteCollection;
  readonly data: Data;
  readonly onChange: (data: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      {SITE_FIELDS[collection].map((field) => (
        <FieldInput
          field={field}
          key={field.key}
          onChange={(value) => onChange(applyFormValue(data, field, value))}
          value={toFormValue(field, data)}
        />
      ))}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  readonly field: SiteField;
  readonly value: string | boolean | Row[];
  readonly onChange: (value: string | boolean | Row[]) => void;
}) {
  if (field.type === 'boolean')
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        {field.label}
      </label>
    );
  if (field.type === 'rows') {
    const rows = Array.isArray(value) ? value : [];
    const change = (index: number, key: string, cell: string) =>
      onChange(rows.map((row, at) => (at === index ? { ...row, [key]: cell } : row)));
    return (
      <fieldset>
        <legend className="text-sm font-medium">{field.label}</legend>
        {rows.map((row, index) => (
          <div className="mt-2 flex gap-2" key={index}>
            {field.columns.map((column) => (
              <input
                aria-label={`${field.label} ${index + 1} ${column.label}`}
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                key={column.key}
                onChange={(event) => change(index, column.key, event.target.value)}
                placeholder={column.optional ? `${column.label}(선택)` : column.label}
                value={row[column.key] ?? ''}
              />
            ))}
            <button
              aria-label={`${field.label} ${index + 1} 삭제`}
              className="px-2 text-sm text-muted hover:text-danger"
              onClick={() => onChange(rows.filter((_, at) => at !== index))}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="mt-2 text-xs text-accent"
          onClick={() => onChange([...rows, emptyRow(field)])}
          type="button"
        >
          {field.label} 추가
        </button>
      </fieldset>
    );
  }
  const text = typeof value === 'string' ? value : '';
  const multiline = field.type !== 'text' && field.type !== 'date';
  return (
    <label className="block text-sm font-medium">
      {field.label}
      {multiline ? (
        <textarea
          className={`${inputClass} min-h-24`}
          onChange={(event) => onChange(event.target.value)}
          value={text}
        />
      ) : (
        <input
          className={inputClass}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.type === 'date' ? 'YYYY-MM-DD(비우면 현재)' : undefined}
          value={text}
        />
      )}
    </label>
  );
}

interface Current {
  readonly collection: SiteCollection;
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly isNew: boolean;
  /** 편집을 시작한 때의 main 원본 해시. 새 항목은 null 이다. */
  readonly baseHash: string | null;
}

/** 사이트 콘텐츠 편집·발행 화면 (NOR-208 AC-6·7). */
export function SiteContent() {
  const [entries, setEntries] = useState<readonly SiteEntryData[]>([]);
  const [problems, setProblems] = useState<readonly { path: string; message: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Current | null>(null);
  const [review, setReview] = useState<{ change: SiteChangeInput; data: SiteReviewData } | null>(
    null,
  );
  const [result, setResult] = useState<PublishResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listSite()
      .then((listing) => {
        if (!alive) return;
        setEntries(listing.entries);
        setProblems(listing.problems);
      })
      .catch((cause: unknown) => alive && setError(message(cause)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  function open(next: Current) {
    setCurrent(next);
    setReview(null);
    setResult(null);
    setError(null);
  }

  async function startReview(change: SiteChangeInput) {
    setBusy(true);
    setError(null);
    try {
      setReview({ change, data: await reviewSite(change) });
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!review) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await confirmSite(review.change, review.data.reviewId));
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="사이트 콘텐츠" className="flex min-h-0 flex-1">
      <div className="w-64 shrink-0 overflow-y-auto border-r border-border p-5">
        {loading ? <p className="text-sm text-muted">main 을 읽는 중입니다.</p> : null}
        <SiteList
          entries={entries}
          onCreate={(collection) =>
            open({ collection, id: '', data: newSiteData(collection), isNew: true, baseHash: null })
          }
          onSelect={(entry) =>
            open({
              collection: entry.collection,
              id: entry.id,
              data: { ...entry.data },
              isNew: false,
              baseHash: entry.hash ?? null,
            })
          }
          selected={current}
        />
        {problems.length > 0 ? (
          <ul className="mt-5 text-xs text-danger">
            {problems.map((problem) => (
              <li key={problem.path}>
                {problem.path}: {problem.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {error ? (
          <p className="mb-4 rounded-md bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {current ? (
          <div className="max-w-2xl">
            <h2 className="mb-4 text-lg font-medium">
              {`${COLLECTIONS.find((item) => item.id === current.collection)?.label ?? ''} · ${
                current.isNew ? '새 항목' : current.id
              }`}
            </h2>
            {current.isNew && current.collection !== 'profile' ? (
              <label className="mb-4 block text-sm font-medium">
                파일 이름
                <input
                  className={inputClass}
                  onChange={(event) => open({ ...current, id: event.target.value })}
                  placeholder="영문 소문자·숫자·하이픈"
                  value={current.id}
                />
              </label>
            ) : null}
            <SiteForm
              collection={current.collection}
              data={current.data}
              onChange={(data) => open({ ...current, data })}
            />
            <div className="mt-6 flex gap-3">
              <button
                className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:bg-border-strong"
                disabled={busy}
                onClick={() =>
                  void startReview({
                    collection: current.collection,
                    id: current.id,
                    data: current.data,
                    baseHash: current.baseHash,
                  })
                }
                type="button"
              >
                검토
              </button>
              {!current.isNew && current.collection !== 'profile' ? (
                <button
                  className="rounded-md px-4 py-2 text-sm text-muted hover:text-danger"
                  disabled={busy}
                  onClick={() =>
                    void startReview({
                      collection: current.collection,
                      id: current.id,
                      delete: true,
                      baseHash: current.baseHash,
                    })
                  }
                  type="button"
                >
                  지우기
                </button>
              ) : null}
            </div>
            {review ? (
              <div className="mt-6 rounded-lg border border-border bg-surface p-5 text-sm">
                <p>
                  {review.data.kind === 'noop'
                    ? '바뀐 것이 없습니다.'
                    : `${review.data.kind === 'delete' ? '삭제' : '쓰기'}: ${review.data.targetPath}`}
                </p>
                <pre
                  aria-label="사이트 콘텐츠 diff"
                  className="mt-2 max-h-96 overflow-auto rounded-lg bg-foreground p-5 font-mono text-xs whitespace-pre text-background"
                >
                  {review.data.diff}
                </pre>
                <button
                  className="mt-3 rounded-md bg-foreground px-4 py-2 text-background disabled:bg-border-strong"
                  disabled={review.data.kind === 'noop' || busy || result !== null}
                  onClick={() => void publish()}
                  type="button"
                >
                  발행
                </button>
                {result ? (
                  <div className="mt-3" role="status">
                    <PublishHandoff exportRef={result.exportRef} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">
            왼쪽에서 항목을 고르세요. 원본은 공개 블로그 main 의 JSON 이고, 발행하면 PR 로
            반영됩니다.
          </p>
        )}
      </div>
    </section>
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
}
