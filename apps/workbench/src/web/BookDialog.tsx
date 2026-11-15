import { useState } from 'react';

import {
  createBook,
  lookupBook,
  uploadBookCover,
  type BookInput,
  type BookMetadata,
} from './api.js';

interface Props {
  readonly onClose: () => void;
  readonly onCreated: () => void;
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
 * 책 등록 (NOR-189).
 *
 * **수기 입력이 기본이고 ISBN 조회는 보조다.** 키 없이 쓸 수 있는 제공처는 국내서를 자주
 * 모르기 때문에, 조회가 비어도 그대로 적어 넣을 수 있어야 한다. 표지도 마찬가지다 — 제공처가
 * 모르는 표지는 사람이 파일로 올린다. 올린 것이 조회로 받은 것보다 앞선다.
 */
export function BookDialog({ onClose, onCreated }: Props) {
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [status, setStatus] = useState<BookInput['status']>('reading');
  const [format, setFormat] = useState<BookInput['format']>('ebook');
  const [source, setSource] = useState<BookInput['source']>('library');
  const [notes, setNotes] = useState('');
  const [found, setFound] = useState<BookMetadata | null>(null);
  const [cover, setCover] = useState<{ path: string; preview: string } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async () => {
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const result = await lookupBook(isbn);
      if (result.metadata === null) {
        setHint('찾지 못했습니다. 직접 적어 넣으세요.');
        return;
      }
      setFound(result.metadata);
      setTitle(result.metadata.title);
      setAuthors(result.metadata.authors.join(', '));
      setHint(`${result.metadata.source} 에서 채웠습니다. 틀린 곳은 고치세요.`);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  /** 파일을 고르는 즉시 올린다. 등록을 누를 때까지 미뤄 두면 실패를 마지막에 알게 된다. */
  const chooseCover = async (file: File | undefined) => {
    if (file === undefined) return;
    setBusy(true);
    setError(null);
    try {
      const key = isbn.trim() === '' ? title.trim() : isbn.trim();
      const result = await uploadBookCover(key === '' ? 'cover' : key, file);
      setCover((current) => {
        if (current !== null) URL.revokeObjectURL(current.preview);
        return { path: result.cover, preview: URL.createObjectURL(file) };
      });
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await createBook({
        title: title.trim(),
        authors: authors
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry !== ''),
        status,
        format,
        source,
        ...(isbn.trim() === '' ? {} : { isbn13: isbn.trim() }),
        ...(found?.publisher === undefined ? {} : { publisher: found.publisher }),
        ...(found?.publishedYear === undefined ? {} : { publishedYear: found.publishedYear }),
        ...(found?.coverUrl === undefined ? {} : { coverUrl: found.coverUrl }),
        ...(cover === null ? {} : { cover: cover.path }),
        ...(coverSource === undefined ? {} : { coverSource }),
        ...(notes.trim() === '' ? {} : { notes }),
      });
      onCreated();
      onClose();
    } catch (caught) {
      setError(toMessage(caught));
      setBusy(false);
    }
  };

  const ready = title.trim() !== '' && authors.trim() !== '';
  /** 올린 표지의 출처는 나다. 적을 것이 없으므로 비운다. */
  const coverSource = cover !== null ? undefined : found?.source;
  const coverPreview = cover?.preview ?? found?.coverUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/40 p-6 pt-[8vh]">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
        <header className="border-b border-stone-200 px-5 py-4">
          <h2 className="font-serif text-xl">책 등록</h2>
          <p className="mt-1 text-sm text-stone-500">
            제목과 저자만 있으면 됩니다. ISBN 이 있으면 나머지를 채워 볼 수 있습니다.
          </p>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-xs text-stone-500">ISBN (선택)</span>
            <span className="mt-1 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 font-mono text-sm"
                onChange={(event) => setIsbn(event.target.value)}
                placeholder="978-89-…"
                value={isbn}
              />
              <button
                className="rounded border border-stone-300 px-3 py-1 text-sm whitespace-nowrap disabled:opacity-40"
                disabled={busy || isbn.trim() === ''}
                onClick={() => void lookup()}
                type="button"
              >
                {busy ? '조회 중…' : '조회'}
              </button>
            </span>
          </label>
          {hint ? <p className="text-[11px] text-stone-500">{hint}</p> : null}

          <label className="block">
            <span className="text-xs text-stone-500">제목</span>
            <input
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1 text-sm"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label className="block">
            <span className="text-xs text-stone-500">저자 (쉼표로 구분)</span>
            <input
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1 text-sm"
              onChange={(event) => setAuthors(event.target.value)}
              value={authors}
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <Choice label="상태" onChange={setStatus} options={STATUSES} value={status} />
            <Choice label="형태" onChange={setFormat} options={FORMATS} value={format} />
            <Choice label="경로" onChange={setSource} options={SOURCES} value={source} />
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-24 w-16 flex-none items-center justify-center overflow-hidden rounded border border-stone-300 bg-stone-100 text-[10px] text-stone-400">
              {coverPreview === undefined ? (
                '표지 없음'
              ) : (
                <img alt="" className="h-full w-full object-cover" src={coverPreview} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-xs text-stone-500">표지</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="mt-1 block w-full text-xs file:mr-2 file:rounded file:border file:border-stone-300 file:bg-white file:px-2 file:py-1 file:text-xs"
                disabled={busy}
                onChange={(event) => void chooseCover(event.target.files?.[0])}
                type="file"
              />
              <span className="mt-1 block text-[11px] text-stone-500">
                {cover === null
                  ? 'JPEG·PNG·WebP, 5MB 까지. 조회로 받은 표지가 있으면 그것을 씁니다.'
                  : '올린 표지를 씁니다.'}
              </span>
            </span>
          </div>

          <label className="block">
            <span className="text-xs text-stone-500">메모 (비공개)</span>
            <textarea
              className="mt-1 h-24 w-full rounded border border-stone-300 px-2 py-1 text-sm"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="밑줄 친 문장이나 생각. 이 내용은 블로그로 나가지 않습니다."
              value={notes}
            />
          </label>
        </div>

        <footer className="border-t border-stone-200 px-5 py-3">
          {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              className="rounded-md px-3 py-2 text-sm text-stone-600"
              onClick={onClose}
              type="button"
            >
              닫기
            </button>
            <button
              className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-40"
              disabled={!ready || busy}
              onClick={() => void save()}
              type="button"
            >
              등록
            </button>
          </div>
        </footer>
      </div>
    </div>
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
    <label className="block">
      <span className="text-xs text-stone-500">{label}</span>
      <select
        className="mt-1 w-full rounded border border-stone-300 px-2 py-1 text-sm"
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : '등록에 실패했습니다.';
}
