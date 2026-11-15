import { useState } from 'react';

import {
  bookCoverUrl,
  changeBookCover,
  lookupBook,
  uploadBookCover,
  updateBook,
  reviewBook,
  confirmBook,
  type BookUpdate,
  type DocumentEntry,
  type BookPublishReviewData,
  type PublishResult,
} from './api.js';
import { bookSlug } from '../core/books/metadata.js';
import { BookPublishReview } from './BookPublishReview.js';
import { BookNotes } from './BookNotes.js';
import { bookExportId } from './bookExportId.js';
import { PublicQuotes } from './PublicQuotes.js';

interface Props {
  readonly document: DocumentEntry;
  readonly onChanged: () => void;
  readonly onEditSource: () => void;
  readonly onError: (message: string) => void;
  /** 휴지통으로 옮긴다(NOR-205). */
  readonly onDelete?: () => void;
}

const STATUSES = [
  ['reading', '읽는 중'],
  ['finished', '완독'],
  ['abandoned', '중단'],
  ['want', '읽고 싶은'],
] as const;
const FORMATS = [
  ['ebook', '전자책'],
  ['paper', '종이책'],
  ['audio', '오디오북'],
] as const;
const SOURCES = [
  ['library', '도서관'],
  ['purchase', '구입'],
  ['subscription', '구독'],
  ['borrowed', '빌림'],
] as const;

/**
 * 책 편집기 (NOR-189).
 *
 * 독서 기록을 남기자고 YAML 을 손으로 맞추게 하지 않는다. 파일은 여전히 사람이 고칠 수 있는
 * 마크다운이고(원본 고치기로 언제든 간다) 이 화면은 그 위에 얹힌 편한 길일 뿐이다.
 *
 * 네 가지가 각자의 자리에 있다: **구절**(저자의 말)과 그에 딸린 **메모**, 옮길 문장 없이 남기는
 * **독서 메모**, 그리고 다 읽고 쓰는 **독서 노트**(아래 큰 칸).
 */
export function BookEditor({ document, onChanged, onEditSource, onError, onDelete }: Props) {
  const initial = document.book;
  /*
    다른 책으로 옮겨 가면 폼도 그 책의 것이어야 한다. 그 일은 호출하는 쪽의 `key` 가 하므로
    여기서는 처음 값만 잡는다 — 구절을 하나 남겨 문서를 다시 읽어도 쓰던 내용이 날아가지 않는다.
  */
  const [form, setForm] = useState<BookUpdate | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<BookPublishReviewData | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);

  if (form === null) {
    return <p className="p-8 text-sm text-muted">책 정보를 읽지 못했습니다.</p>;
  }

  const set = <K extends keyof BookUpdate>(key: K, value: BookUpdate[K]) =>
    setForm((current) => (current === null ? current : { ...current, [key]: value }));

  /** 빈 칸은 지운 것이다. 없는 값을 빈 문자열로 남기면 파일에 빈 줄이 쌓인다. */
  const setOptional = (key: keyof BookUpdate, value: string) =>
    setForm((current) =>
      current === null
        ? current
        : withField(current, key, value.trim() === '' ? undefined : value.trim()),
    );

  const save = async () => {
    setBusy(true);
    try {
      await updateBook(document.id, form);
      onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const bookId = bookExportId(document);
  const runReview = async () => {
    setBusy(true);
    try {
      setResult(null);
      setReview(await reviewBook(bookId));
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : '검토하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (review === null) return;
    setBusy(true);
    try {
      setResult(await confirmBook(bookId, review.reviewId));
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : '내보내지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  /** 표지는 저장 버튼과 따로 바로 바뀐다(NOR-204). 폼에 쓰던 내용은 건드리지 않는다. */
  const replaceCover = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
      onChanged();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : '표지를 바꾸지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  const coverKey = form.isbn13 ?? bookSlug(form.title);
  const uploadCover = (file: File | undefined) =>
    file === undefined
      ? undefined
      : void replaceCover(async () => {
          const { cover: path } = await uploadBookCover(coverKey, file);
          await changeBookCover(document.id, { cover: path });
        });
  const findCover = () =>
    void replaceCover(async () => {
      const isbn = form.isbn13;
      if (isbn === undefined) throw new Error('ISBN 을 먼저 적고 저장하세요.');
      const { metadata } = await lookupBook(isbn);
      if (metadata?.coverUrl === undefined)
        throw new Error('이 ISBN 으로는 표지를 찾지 못했습니다.');
      await changeBookCover(document.id, {
        coverUrl: metadata.coverUrl,
        coverSource: metadata.source,
      });
    });
  const removeCover = () => void replaceCover(() => changeBookCover(document.id, { remove: true }));

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const cover = document.cover === undefined ? null : bookCoverUrl(document.cover);

  return (
    <section aria-label="책 편집기" className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border px-6">
        <div>
          <h2 className="text-sm font-medium text-foreground">{form.title}</h2>
          <p className="text-xs text-muted">읽은 책</p>
        </div>
        <div className="flex gap-2">
          {onDelete ? (
            <button
              className="text-muted hover:text-danger rounded-md px-3 py-2 text-sm disabled:opacity-40"
              disabled={busy}
              onClick={onDelete}
              type="button"
            >
              삭제
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-body disabled:opacity-40"
            disabled={busy || dirty}
            onClick={() => void runReview()}
          >
            {form.visible ? '책장으로 내보내기' : '책장에서 빼기'}
          </button>
          <button
            className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-body"
            onClick={onEditSource}
            type="button"
          >
            원본 고치기
          </button>
          <button
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:bg-border-strong"
            disabled={!dirty || busy}
            onClick={() => void save()}
            type="button"
          >
            {busy ? '저장 중…' : dirty ? '저장' : '저장됨'}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {review ? (
          <BookPublishReview
            review={review}
            cover={document.cover ?? '표지 없음'}
            busy={busy}
            result={result}
            onClose={() => setReview(null)}
            onConfirm={() => void confirm()}
          />
        ) : null}
        <div className="flex gap-5">
          <div className="flex w-24 flex-none flex-col gap-1.5">
            <span className="flex h-36 w-24 items-center justify-center overflow-hidden rounded border border-border bg-surface-sunken text-[11px] text-muted">
              {cover === null ? (
                '표지 없음'
              ) : (
                <img alt="" className="h-full w-full object-cover" src={cover} />
              )}
            </span>
            <label className="cursor-pointer rounded border border-border-strong bg-surface px-2 py-1 text-center text-xs text-body hover:border-muted">
              파일로 바꾸기
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={(event) => uploadCover(event.target.files?.[0])}
                type="file"
              />
            </label>
            <button
              className="rounded border border-border-strong bg-surface px-2 py-1 text-xs text-body hover:border-muted disabled:opacity-40"
              disabled={busy || form.isbn13 === undefined}
              onClick={findCover}
              title={form.isbn13 === undefined ? 'ISBN 을 먼저 적고 저장하세요.' : undefined}
              type="button"
            >
              ISBN 으로 찾기
            </button>
            <button
              className="rounded px-2 py-1 text-xs text-muted hover:text-danger disabled:opacity-40"
              disabled={busy || cover === null}
              onClick={removeCover}
              type="button"
            >
              표지 지우기
            </button>
          </div>

          <div className="grid min-w-0 flex-1 gap-3">
            <Field label="제목">
              <input
                className="w-full rounded border border-border-strong px-2 py-1 text-sm"
                onChange={(event) => set('title', event.target.value)}
                value={form.title}
              />
            </Field>
            <Field label="저자 (쉼표로 구분)">
              <ListInput onChange={(names) => set('authors', names)} values={form.authors} />
            </Field>
            <Field label="역자 (쉼표로 구분)">
              <ListInput
                onChange={(names) =>
                  setForm((current) =>
                    current === null
                      ? current
                      : withField(current, 'translators', names.length === 0 ? undefined : names),
                  )
                }
                values={form.translators ?? []}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="출판사">
                <input
                  className="w-full rounded border border-border-strong px-2 py-1 text-sm"
                  onChange={(event) => setOptional('publisher', event.target.value)}
                  value={form.publisher ?? ''}
                />
              </Field>
              <Field label="출간 연도">
                <input
                  className="w-full rounded border border-border-strong px-2 py-1 font-mono text-sm"
                  inputMode="numeric"
                  onChange={(event) =>
                    setForm((current) => {
                      if (current === null) return current;
                      const year = Number.parseInt(event.target.value, 10);
                      return withField(
                        current,
                        'publishedYear',
                        Number.isFinite(year) ? year : undefined,
                      );
                    })
                  }
                  value={form.publishedYear === undefined ? '' : String(form.publishedYear)}
                />
              </Field>
              <Field label="ISBN">
                <input
                  className="w-full rounded border border-border-strong px-2 py-1 font-mono text-sm"
                  onChange={(event) =>
                    setOptional('isbn13', event.target.value.replace(/[^0-9]/gu, ''))
                  }
                  value={form.isbn13 ?? ''}
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Choice
                label="상태"
                onChange={(value) => set('status', value)}
                options={STATUSES}
                value={form.status}
              />
              <Choice
                label="형태"
                onChange={(value) => set('format', value)}
                options={FORMATS}
                value={form.format}
              />
              <Choice
                label="경로"
                onChange={(value) => set('source', value)}
                options={SOURCES}
                value={form.source}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="시작한 날">
                <input
                  className="w-full rounded border border-border-strong px-2 py-1 text-sm"
                  onChange={(event) => setOptional('startedAt', event.target.value)}
                  type="date"
                  value={form.startedAt ?? ''}
                />
              </Field>
              <Field label="다 읽은 날">
                <input
                  className="w-full rounded border border-border-strong px-2 py-1 text-sm"
                  onChange={(event) => setOptional('finishedAt', event.target.value)}
                  type="date"
                  value={form.finishedAt ?? ''}
                />
              </Field>
              <Field label="별점">
                <select
                  className="w-full rounded border border-border-strong px-2 py-1 text-sm"
                  onChange={(event) =>
                    setForm((current) =>
                      current === null
                        ? current
                        : withField(
                            current,
                            'rating',
                            event.target.value === '' ? undefined : Number(event.target.value),
                          ),
                    )
                  }
                  value={form.rating === undefined ? '' : String(form.rating)}
                >
                  <option value="">없음</option>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <option key={score} value={score}>
                      {'★'.repeat(score)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-border pt-5">
          <Field label="한 줄 감상 — 블로그에 나가는 유일한 글입니다">
            <input
              className="w-full rounded border border-border-strong px-2 py-1 text-sm"
              onChange={(event) => setOptional('oneLiner', event.target.value)}
              placeholder="비워 두면 목록에 제목과 저자만 남습니다."
              value={form.oneLiner ?? ''}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="태그 (쉼표로 구분)">
              <ListInput
                onChange={(tags) =>
                  setForm((current) =>
                    current === null
                      ? current
                      : withField(current, 'tags', tags.length === 0 ? undefined : tags),
                  )
                }
                values={form.tags ?? []}
              />
            </Field>
            <label className="flex items-end gap-2 pb-1 text-sm text-body">
              <input
                checked={form.visible}
                onChange={(event) => set('visible', event.target.checked)}
                type="checkbox"
              />
              읽은 목록에 공개
            </label>
          </div>
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <Field label="독서 노트 — 다 읽고 남기는 짧은 독후감">
            <textarea
              className="h-40 w-full rounded border border-border-strong px-3 py-2 text-sm leading-relaxed"
              onChange={(event) => set('content', event.target.value)}
              placeholder="이 책이 어땠는지. 구절과 메모는 아래에 따로 쌓입니다."
              value={form.content}
            />
          </Field>
        </div>

        <PublicQuotes
          authors={form.authors}
          excerpts={document.excerpts ?? []}
          title={form.title}
        />
        <div className="mt-5 grid grid-cols-2 gap-6 border-t border-border pt-5">
          <BookNotes
            documentId={document.id}
            bookId={bookId}
            items={document.excerpts ?? []}
            list="excerpts"
            onChanged={onChanged}
            onError={onError}
          />
          <BookNotes
            documentId={document.id}
            items={document.memos ?? []}
            list="memos"
            onChanged={onChanged}
            onError={onError}
          />
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  readonly label: string;
  readonly options: readonly (readonly [T, string])[];
  readonly value: T;
  readonly onChange: (next: T) => void;
}) {
  return (
    <Field label={label}>
      <select
        className="w-full rounded border border-border-strong px-2 py-1 text-sm"
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** 값이 없으면 키 자체를 뺀다. 빈 문자열을 남기면 파일에 빈 필드가 쌓인다. */
function withField(form: BookUpdate, key: keyof BookUpdate, value: unknown): BookUpdate {
  const entries = Object.entries(form).filter(([name]) => name !== key);
  return Object.fromEntries(
    value === undefined ? entries : [...entries, [key, value]],
  ) as unknown as BookUpdate;
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/**
 * 쉼표로 구분하는 목록 칸. 친 글자를 그대로 보여 주고, 목록은 따로 넘긴다. 목록에서 다시 글자를
 * 만들어 보여 주면 친 쉼표와 공백이 바로 사라져 두 번째 이름을 칠 수 없다(NOR-204).
 */
function ListInput({
  values,
  onChange,
}: {
  readonly values: readonly string[];
  readonly onChange: (values: string[]) => void;
}) {
  const [text, setText] = useState(() => values.join(', '));
  return (
    <input
      className="w-full rounded border border-border-strong px-2 py-1 text-sm"
      onChange={(event) => {
        setText(event.target.value);
        onChange(splitList(event.target.value));
      }}
      value={text}
    />
  );
}
