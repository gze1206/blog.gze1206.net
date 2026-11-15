import { useCallback, useEffect, useRef, useState } from 'react';

import {
  confirmSite,
  listSite,
  reviewSite,
  siteImagePreview,
  uploadSiteImage,
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
  rowId,
  toFormValue,
  type FormValue,
  type Row,
  type SiteField,
} from './siteForm.js';
import { DiffView } from '../diff/DiffView.js';
import { trackPublish } from '../publish/trackPublish.js';

const COLLECTIONS: readonly { id: SiteCollection; label: string }[] = [
  { id: 'profile', label: '프로필' },
  { id: 'experience', label: '경력' },
  { id: 'portfolio', label: '포트폴리오' },
  { id: 'series', label: '시리즈' },
];

type Data = Readonly<Record<string, unknown>>;

function entryKey(entry: { readonly collection: string; readonly id: string }): string {
  return `${entry.collection}/${entry.id}`;
}

/**
 * 파일 이름 칸 (NOR-220 AC-3). 새 항목은 언제나, 기존 항목은 경력·포트폴리오만 바꿀 수 있다.
 * 시리즈는 글이 파일 이름으로 참조하므로 바꾸지 않는다.
 */
export function FileNameField({
  collection,
  isNew,
  value,
  onChange,
}: {
  readonly collection: SiteCollection;
  readonly isNew: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  if (collection === 'profile') return null;
  if (!isNew && collection !== 'experience' && collection !== 'portfolio') return null;
  return (
    <label className="mb-4 block text-sm font-medium">
      파일 이름
      <input
        className={inputClass}
        onChange={(event) => onChange(event.target.value)}
        placeholder="영문 소문자·숫자·하이픈"
        value={value}
      />
      {isNew ? null : (
        <span className="mt-1 block text-xs font-normal text-muted">
          바꾸면 발행할 때 옛 파일을 지우고 새 이름으로 옮깁니다.
        </span>
      )}
    </label>
  );
}

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
  pending = new Set(),
}: {
  readonly entries: readonly SiteEntryData[];
  /** 발행했지만 아직 main 에 반영되지 않은 항목(`컬렉션/id`). */
  readonly pending?: ReadonlySet<string>;
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
                    {pending.has(entryKey(entry)) ? (
                      <span className="ml-2 text-xs text-notice-foreground">반영 대기</span>
                    ) : null}
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

type FormUpdate = (
  data: Data,
  drafts: Readonly<Record<string, FormValue>>,
) => { data: Record<string, unknown>; drafts: Record<string, FormValue> };
type ValueUpdate = FormValue | ((previous: FormValue) => FormValue);

export function SiteForm({
  collection,
  data,
  drafts = {},
  onChange,
}: {
  readonly collection: SiteCollection;
  readonly data: Data;
  /** 칸마다 입력한 원문(NOR-219 AC-1). 없으면 데이터에서 그린다. */
  readonly drafts?: Readonly<Record<string, FormValue>>;
  /** 최신 상태에 적용할 갱신을 넘긴다. 올리기처럼 늦게 끝나는 일이 그사이 바뀐 것을 덮지 않게 한다. */
  readonly onChange: (update: FormUpdate) => void;
}) {
  return (
    <div className="space-y-4">
      {SITE_FIELDS[collection].map((field) => (
        <FieldInput
          field={field}
          key={field.key}
          onChange={(next) =>
            onChange((latestData, latestDrafts) => {
              const previous = latestDrafts[field.key] ?? toFormValue(field, latestData);
              const value = typeof next === 'function' ? next(previous) : next;
              return {
                data: applyFormValue(latestData, field, value),
                drafts: { ...latestDrafts, [field.key]: value },
              };
            })
          }
          value={drafts[field.key] ?? toFormValue(field, data)}
        />
      ))}
    </div>
  );
}

/** 이미지 미리보기. 올린 이미지는 워크벤치에서, 블로그에 있는 이미지는 블로그에서 읽는다. */
function ImagePreview({ src, label }: { readonly src: string; readonly label: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src.startsWith('/')) return null;
  const { primary, fallback } = siteImagePreview(src);
  const url = failed === primary ? fallback : primary;
  return (
    <img
      alt={label}
      className="h-20 w-28 shrink-0 rounded border border-border bg-surface-sunken object-contain"
      onError={() => setFailed(url)}
      src={url}
    />
  );
}

/** 파일을 골라 올리고 결과(경로·크기)를 넘긴다. */
function ImageUpload({
  label,
  onUploaded,
}: {
  readonly label: string;
  readonly onUploaded: (image: { src: string; width: number; height: number }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return (
    <span className="inline-flex items-center gap-2">
      <label className="cursor-pointer rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground">
        {busy ? '올리는 중…' : '이미지 올리기'}
        <input
          accept="image/png,image/jpeg,image/webp"
          aria-label={label}
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setBusy(true);
            setError(null);
            uploadSiteImage(file)
              .then((image) => {
                // 그사이 이 칸이 사라졌으면(다른 항목을 열었으면) 결과를 버린다.
                if (mounted.current) onUploaded(image);
              })
              .catch((cause: unknown) => {
                if (mounted.current)
                  setError(cause instanceof Error ? cause.message : '이미지를 올리지 못했습니다.');
              })
              .finally(() => {
                if (mounted.current) setBusy(false);
              });
          }}
          type="file"
        />
      </label>
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  readonly field: SiteField;
  readonly value: FormValue;
  readonly onChange: (value: ValueUpdate) => void;
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
    // 행은 id 로 찾고 최신 행 목록에 적용한다. 올리는 사이 행을 지우거나 고쳐도 엉뚱한 행을 바꾸지 않는다.
    const change = (id: string, patch: Row) =>
      onChange((previous) =>
        (Array.isArray(previous) ? previous : []).map((row) =>
          rowId(row) === id ? { ...row, ...patch } : row,
        ),
      );
    return (
      <fieldset>
        <legend className="text-sm font-medium">{field.label}</legend>
        {rows.map((row, index) => (
          <div
            className={
              field.images
                ? 'mt-2 flex gap-3 rounded-md border border-border p-3'
                : 'mt-2 flex gap-2'
            }
            key={rowId(row) || index}
          >
            {field.images ? (
              <div className="flex shrink-0 flex-col items-start gap-2">
                <ImagePreview
                  label={`${field.label} ${index + 1} 미리보기`}
                  src={row['src'] ?? ''}
                />
                <ImageUpload
                  label={`${field.label} ${index + 1} 파일`}
                  onUploaded={(image) =>
                    change(rowId(row), {
                      src: image.src,
                      width: String(image.width),
                      height: String(image.height),
                    })
                  }
                />
              </div>
            ) : null}
            <div className={field.images ? 'grid flex-1 grid-cols-2 gap-2' : 'flex flex-1 gap-2'}>
              {field.columns.map((column) => (
                <input
                  aria-label={`${field.label} ${index + 1} ${column.label}`}
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
                  key={column.key}
                  onChange={(event) => change(rowId(row), { [column.key]: event.target.value })}
                  placeholder={column.optional ? `${column.label}(선택)` : column.label}
                  value={row[column.key] ?? ''}
                />
              ))}
            </div>
            <button
              aria-label={`${field.label} ${index + 1} 삭제`}
              className="self-start px-2 text-sm text-muted hover:text-danger"
              onClick={() =>
                onChange((previous) =>
                  (Array.isArray(previous) ? previous : []).filter(
                    (candidate) => rowId(candidate) !== rowId(row),
                  ),
                )
              }
              type="button"
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="mt-2 text-xs text-accent"
          onClick={() =>
            onChange((previous) => [...(Array.isArray(previous) ? previous : []), emptyRow(field)])
          }
          type="button"
        >
          {field.label} 추가
        </button>
      </fieldset>
    );
  }
  const text = typeof value === 'string' ? value : '';
  if (field.type === 'image')
    return (
      <div className="text-sm font-medium">
        <label className="block">
          {field.label}
          <input
            className={inputClass}
            onChange={(event) => onChange(event.target.value)}
            placeholder="/img/... (올리면 채워집니다)"
            value={text}
          />
        </label>
        <div className="mt-2 flex items-center gap-3">
          <ImagePreview label={`${field.label} 미리보기`} src={text} />
          <ImageUpload label={`${field.label} 파일`} onUploaded={(image) => onChange(image.src)} />
        </div>
      </div>
    );
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

let sessions = 0;
function nextSession(): number {
  sessions += 1;
  return sessions;
}

interface Current {
  readonly collection: SiteCollection;
  readonly id: string;
  readonly data: Record<string, unknown>;
  readonly isNew: boolean;
  /** 칸마다 입력한 원문. 데이터에서 다시 그리면 빈 줄·공백이 사라진다(NOR-219). */
  readonly drafts: Record<string, FormValue>;
  /** 항목을 열 때마다 바뀐다. 늦게 끝난 갱신이 다른 항목에 들어가지 않게 한다. */
  readonly session: number;
  /** 편집을 시작한 때의 main 원본 해시. 새 항목은 null 이다. */
  readonly baseHash: string | null;
  /** 연 때의 id. 바꾸면 이름 바꾸기다(NOR-220). */
  readonly originalId: string;
  /** 발행했지만 아직 반영되지 않은 항목이면 다시 검토하지 않는다. */
  readonly pending: boolean;
}

/** 발행했지만 main 에 아직 없는 변경(NOR-220 AC-4). */
interface PendingChange {
  readonly key: string;
  readonly entry: SiteEntryData | null;
  readonly removed: string | null;
}

/** main 목록에 아직 반영되지 않은 발행을 겹쳐 보인다. 반영된 것은 대기에서 뺀다. */
function mergePending(
  main: readonly SiteEntryData[],
  pending: readonly PendingChange[],
): { entries: SiteEntryData[]; pending: PendingChange[] } {
  const byKey = new Map(main.map((entry) => [entryKey(entry), entry]));
  const waiting = pending.filter((change) => {
    const landed = change.entry
      ? JSON.stringify(byKey.get(change.key)?.data) === JSON.stringify(change.entry.data)
      : !byKey.has(change.key);
    return !(landed && (change.removed === null || !byKey.has(change.removed)));
  });
  const hidden = new Set(waiting.flatMap((change) => [change.key, change.removed ?? '']));
  const entries = main.filter((entry) => !hidden.has(entryKey(entry)));
  for (const change of waiting) if (change.entry) entries.push(change.entry);
  return { entries, pending: waiting };
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

  const [pending, setPending] = useState<readonly PendingChange[]>([]);
  const pendingKeys = new Set(pending.map((change) => change.key));

  /** main 을 새로 읽는다. 반영되지 않은 발행은 겹쳐 보인다. */
  const reload = useCallback(async (waiting: readonly PendingChange[]) => {
    try {
      const listing = await listSite();
      const merged = mergePending(listing.entries, waiting);
      setEntries(merged.entries);
      setPending(merged.pending);
      setProblems(listing.problems);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, []);

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

  /** 지금 열린 항목(같은 세션)에만 갱신을 적용한다. */
  function edit(session: number, update: FormUpdate) {
    setCurrent((previous) =>
      previous && previous.session === session
        ? { ...previous, ...update(previous.data, previous.drafts) }
        : previous,
    );
    setReview(null);
    setResult(null);
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
      const confirmed = await confirmSite(review.change, review.data.reviewId);
      setResult(confirmed);
      trackPublish(confirmed.outboxRef, `사이트 · ${review.change.collection}/${review.change.id}`);
      // 병합되기 전까지 목록이 main 의 옛 내용을 보이지 않게, 발행한 내용을 대기로 겹친다.
      const change = review.change;
      const removed =
        'renameFrom' in change && change.renameFrom
          ? `${change.collection}/${change.renameFrom}`
          : null;
      const published: PendingChange =
        'delete' in change
          ? { key: entryKey(change), entry: null, removed: null }
          : {
              key: entryKey(change),
              removed,
              entry: {
                collection: change.collection,
                id: change.id,
                data:
                  'renameFrom' in change && (change.data as Data)['id'] === change.renameFrom
                    ? { ...(change.data as Data), id: change.id }
                    : (change.data as Data),
              },
            };
      const next = [...pending.filter((item) => item.key !== published.key), published];
      setPending(next);
      setEntries((current) => mergePending(current, next).entries);
      setCurrent((open) => (open ? { ...open, pending: true } : open));
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
        <button
          className="mb-4 rounded border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground disabled:opacity-50"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void reload(pending);
          }}
          type="button"
        >
          main 다시 읽기
        </button>
        <SiteList
          entries={entries}
          pending={pendingKeys}
          onCreate={(collection) =>
            open({
              collection,
              id: '',
              data: newSiteData(collection),
              isNew: true,
              baseHash: null,
              originalId: '',
              pending: false,
              drafts: {},
              session: nextSession(),
            })
          }
          onSelect={(entry) =>
            open({
              collection: entry.collection,
              id: entry.id,
              data: { ...entry.data },
              isNew: false,
              baseHash: entry.hash ?? null,
              originalId: entry.id,
              pending: pendingKeys.has(entryKey(entry)),
              drafts: {},
              session: nextSession(),
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
            <FileNameField
              collection={current.collection}
              isNew={current.isNew}
              onChange={(id) => setCurrent({ ...current, id })}
              value={current.id}
            />
            {current.pending ? (
              <p className="mb-4 rounded-md bg-notice px-4 py-3 text-sm text-notice-foreground">
                발행한 내용이 블로그에 반영되기를 기다리는 중입니다(PR 병합). 반영된 뒤 &quot;main
                다시 읽기&quot; 를 누르면 다시 고칠 수 있습니다.
              </p>
            ) : null}
            <SiteForm
              collection={current.collection}
              data={current.data}
              drafts={current.drafts}
              onChange={(update) => edit(current.session, update)}
            />
            <div className="mt-6 flex gap-3">
              <button
                className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:bg-border-strong"
                disabled={busy || current.pending}
                onClick={() =>
                  void startReview({
                    collection: current.collection,
                    id: current.id,
                    data: current.data,
                    baseHash: current.baseHash,
                    ...(!current.isNew && current.id !== current.originalId
                      ? { renameFrom: current.originalId }
                      : {}),
                  })
                }
                type="button"
              >
                검토
              </button>
              {!current.isNew && current.collection !== 'profile' ? (
                <button
                  className="rounded-md px-4 py-2 text-sm text-muted hover:text-danger"
                  disabled={busy || current.pending}
                  onClick={() =>
                    void startReview({
                      collection: current.collection,
                      id: current.originalId,
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
                {review.data.warnings?.map((warning) => (
                  <p className="mt-1 text-notice-foreground" key={warning}>
                    {warning}
                  </p>
                ))}
                <DiffView diff={review.data.diff} label="사이트 콘텐츠 diff" />
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
