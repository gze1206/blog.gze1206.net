import { useEffect, useMemo, useState } from 'react';

import { matchImportablePosts } from '../core/import/search.js';
import {
  importPosts,
  listImportablePosts,
  type ImportablePost,
  type ImportResolution,
  type ImportSelectionInput,
} from './api.js';

interface Props {
  readonly onClose: () => void;
  readonly onImported: () => void;
}

/**
 * 블로그 글 가져오기 (NOR-187).
 *
 * 고르는 일과 겹침을 푸는 일을 한 화면에서 한다. 목록에 겹치는 slug 를 미리 표시하므로,
 * 확인을 누른 뒤에 처음 알게 되는 일이 없다.
 *
 * 목록은 검색으로 좁힌다 — 글 수는 줄지 않는다. 고른 것은 검색어를 바꿔도 그대로 남으므로
 * (선택은 `repoPath` 로 기억한다), 여러 번 나눠 검색하며 골라 담을 수 있다. 대신 화면 밖에
 * 고른 것이 있으면 그 사실을 아래에 적는다 — 안 보이는 것이 딸려 가면 안 된다.
 */
export function ImportDialog({ onClose, onImported }: Props) {
  const [posts, setPosts] = useState<ImportablePost[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [resolutions, setResolutions] = useState<Record<string, ImportResolution>>({});
  const [slugs, setSlugs] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'working'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listImportablePosts()
      .then((result) => {
        if (!active) return;
        setPosts(result.posts);
        setStatus('ready');
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(toMessage(caught));
        setStatus('ready');
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => matchImportablePosts(posts, query), [posts, query]);
  const chosen = posts.filter((post) => selected[post.repoPath]);
  const hiddenChosen = chosen.length - visible.filter((post) => selected[post.repoPath]).length;
  const undecided = chosen.filter(
    (post) => post.conflictsWith !== null && resolutions[post.repoPath] === undefined,
  );

  const hiddenUndecided = undecided.filter(
    (post) => !visible.some((candidate) => candidate.repoPath === post.repoPath),
  ).length;

  const apply = async () => {
    setStatus('working');
    setError(null);
    try {
      const selections: ImportSelectionInput[] = chosen.map((post) => {
        const resolution = resolutions[post.repoPath];
        const slug = slugs[post.repoPath];
        if (resolution === 'rename' && slug !== undefined)
          return { repoPath: post.repoPath, resolution, slug };
        return resolution === undefined
          ? { repoPath: post.repoPath }
          : { repoPath: post.repoPath, resolution };
      });
      const result = await importPosts(selections);
      if (!result.cancelled) onImported();
      onClose();
    } catch (caught) {
      setError(toMessage(caught));
      setStatus('ready');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/40 p-6 pt-[8vh]">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
        <header className="border-b border-stone-200 px-5 py-4">
          <h2 className="font-serif text-xl">블로그에서 가져오기</h2>
          <p className="mt-1 text-sm text-stone-500">
            가져올 글을 고르세요. 같은 slug 가 이미 있으면 어떻게 할지 함께 정합니다.
          </p>
          <input
            className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목이나 slug 로 찾기"
            type="search"
            value={query}
          />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {status === 'loading' ? (
            <p className="text-sm text-stone-500">블로그를 읽는 중입니다…</p>
          ) : null}
          {status !== 'loading' && posts.length === 0 ? (
            <p className="text-sm text-stone-500">가져올 글이 없습니다.</p>
          ) : null}
          {status !== 'loading' && posts.length > 0 ? (
            <p className="mb-3 text-[11px] text-stone-500">
              {posts.length}편 중 {visible.length}편 표시
              {chosen.length > 0 ? ` · ${chosen.length}편 선택` : ''}
            </p>
          ) : null}
          {status !== 'loading' && posts.length > 0 && visible.length === 0 ? (
            <p className="text-sm text-stone-500">찾는 글이 없습니다.</p>
          ) : null}

          <ul className="grid gap-2">
            {visible.map((post) => {
              const isSelected = selected[post.repoPath] === true;
              return (
                <li className="rounded-lg border border-stone-200 px-3 py-2" key={post.repoPath}>
                  <label className="flex items-start gap-3">
                    <input
                      checked={isSelected}
                      className="mt-1"
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [post.repoPath]: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-stone-800">{post.title}</span>
                      <span className="block font-mono text-[11px] text-stone-400">
                        {post.slug}
                        {post.draft ? ' · draft' : ''}
                      </span>
                    </span>
                  </label>

                  {isSelected && post.conflictsWith !== null ? (
                    <div className="mt-2 rounded-md bg-amber-50 px-3 py-2">
                      <p className="text-[11px] text-amber-900">
                        이미 <span className="font-mono">{post.conflictsWith}</span> 가 같은 slug 를
                        쓰고 있습니다.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(['rename', 'overwrite', 'skip', 'cancel'] as const).map((option) => (
                          <button
                            aria-pressed={resolutions[post.repoPath] === option}
                            className="rounded border border-amber-300 px-2 py-1 text-[11px] aria-pressed:bg-amber-200"
                            key={option}
                            onClick={() =>
                              setResolutions((current) => ({ ...current, [post.repoPath]: option }))
                            }
                            type="button"
                          >
                            {labelOf(option)}
                          </button>
                        ))}
                      </div>
                      {resolutions[post.repoPath] === 'rename' ? (
                        <input
                          className="mt-2 w-full rounded border border-amber-300 px-2 py-1 font-mono text-[11px]"
                          onChange={(event) =>
                            setSlugs((current) => ({
                              ...current,
                              [post.repoPath]: event.target.value,
                            }))
                          }
                          placeholder="새 slug (예: alpha-2)"
                          value={slugs[post.repoPath] ?? ''}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="border-t border-stone-200 px-5 py-3">
          {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
          {hiddenChosen > 0 ? (
            <p className="mb-2 text-[11px] text-stone-500">
              검색어 밖에서 고른 {hiddenChosen}편도 함께 가져옵니다.
            </p>
          ) : null}
          {undecided.length > 0 ? (
            <p className="mb-2 text-[11px] text-amber-800">
              겹치는 {undecided.length}편을 어떻게 할지 정해야 가져올 수 있습니다.
              {hiddenUndecided > 0 ? ' 검색어를 지우면 남은 것이 보입니다.' : ''}
            </p>
          ) : null}
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
              disabled={chosen.length === 0 || undecided.length > 0 || status === 'working'}
              onClick={() => void apply()}
              type="button"
            >
              {chosen.length}개 가져오기
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function labelOf(resolution: ImportResolution): string {
  if (resolution === 'rename') return '다른 slug 로';
  if (resolution === 'overwrite') return '덮어쓰기';
  if (resolution === 'skip') return '건너뛰기';
  return '전체 취소';
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : '가져오기에 실패했습니다.';
}
