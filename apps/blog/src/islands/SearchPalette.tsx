import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { canSearch } from '../lib/search';

interface SearchResult {
  readonly url: string;
  readonly meta: { readonly title: string; readonly series?: string };
  readonly excerpt: string;
}

interface PagefindModule {
  search(
    query: string,
  ): Promise<{ readonly results: readonly { data(): Promise<SearchResult> }[] }>;
}

async function searchPagefind(query: string): Promise<readonly SearchResult[]> {
  const pagefind = (await import(/* @vite-ignore */ '/pagefind/pagefind.js')) as PagefindModule;
  const response = await pagefind.search(query);
  return Promise.all(response.results.slice(0, 8).map((result) => result.data()));
}

interface PaletteProps {
  /** 팔레트를 여닫는 함수를 바깥(머리글 스크립트)에 넘긴다. */
  readonly register: (setOpen: (next: OpenUpdate) => void) => void;
  /** 닫힐 때 포커스를 돌려줄 검색 링크. */
  readonly trigger: HTMLElement;
}

/**
 * Pagefind cmdk 검색 팔레트 (NOR-31).
 *
 * 머리글의 검색 링크(`SearchTrigger.astro`)가 처음 열 때 이 모듈을 불러온다(NOR-231). 그래서
 * 검색을 쓰지 않는 방문자는 React 를 받지 않는다. 단축키와 클릭은 링크 쪽 스크립트가 듣는다.
 */
function SearchPalette({ register, trigger }: PaletteProps) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly SearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => register(setOpen), [register]);

  useEffect(() => {
    if (!open || !canSearch(query)) {
      setResults([]);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    void searchPagefind(query)
      .then((next) => {
        if (!cancelled) {
          setResults(next);
          setStatus('idle');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  function close(openState: boolean): void {
    setOpen(openState);
    if (!openState) requestAnimationFrame(() => trigger.focus());
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={close}
      label="블로그 검색"
      className="bg-scrim fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]"
    >
      <div className="border-border bg-surface w-full max-w-xl overflow-hidden rounded-lg border shadow-xl">
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="두 글자 이상 입력해 글 검색"
          aria-label="블로그 글 검색"
          className="border-border w-full border-b bg-transparent px-4 py-3 outline-none"
        />
        <Command.List className="max-h-[55vh] overflow-y-auto p-2">
          {!canSearch(query) && <p className="text-muted p-3 text-sm">두 글자 이상 입력하세요.</p>}
          {status === 'loading' && <p className="text-muted p-3 text-sm">검색 중…</p>}
          {status === 'error' && (
            <p className="text-danger p-3 text-sm">검색 인덱스를 불러오지 못했습니다.</p>
          )}
          {canSearch(query) && status === 'idle' && results.length === 0 && (
            <Command.Empty className="text-muted p-3 text-sm">검색 결과가 없습니다.</Command.Empty>
          )}
          {results.map((result) => (
            <Command.Item key={result.url} value={result.meta.title} asChild>
              <a
                href={result.url}
                className="data-[selected=true]:bg-surface-sunken dark:data-[selected=true]:bg-surface-sunken block rounded px-3 py-2"
              >
                {result.meta.series !== undefined && (
                  <span className="series-label block">
                    <span className="sr-only">시리즈 </span>
                    {result.meta.series}
                  </span>
                )}
                <strong>{result.meta.title}</strong>
                <span
                  className="text-muted mt-1 block text-sm"
                  dangerouslySetInnerHTML={{ __html: result.excerpt }}
                />
              </a>
            </Command.Item>
          ))}
        </Command.List>
      </div>
    </Command.Dialog>
  );
}

type OpenUpdate = boolean | ((open: boolean) => boolean);

/**
 * 팔레트를 열린 채로 문서 끝에 띄우고, 여닫는 함수를 돌려준다.
 *
 * 첫 렌더가 끝나기 전에 들어온 요청은 하나만 기억했다가 넘긴다.
 */
export function mountSearchPalette(trigger: HTMLElement): (next: OpenUpdate) => void {
  const container = document.createElement('div');
  document.body.append(container);
  let setOpen: ((next: OpenUpdate) => void) | null = null;
  let queued: OpenUpdate | null = null;
  const register = (setter: (next: OpenUpdate) => void) => {
    setOpen = setter;
    if (queued !== null) setter(queued);
    queued = null;
  };
  createRoot(container).render(<SearchPalette register={register} trigger={trigger} />);
  return (next) => {
    if (setOpen) setOpen(next);
    else queued = next;
  };
}
