import { Command } from 'cmdk';
import { useEffect, useRef, useState } from 'react';
import { canSearch, isSearchShortcut } from '../lib/search';

interface SearchResult {
  readonly url: string;
  readonly meta: { readonly title: string };
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

/** JS 미지원 시 `/blog` 링크로 남는 Pagefind cmdk 검색 팔레트 (NOR-31). */
export default function SearchPalette() {
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly SearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSearchShortcut(event)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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
    if (!openState) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <a
        ref={triggerRef}
        href="/blog"
        className="text-muted hover:text-foreground rounded text-sm"
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        검색 <kbd className="ml-1 rounded border px-1 text-xs">⌘K</kbd>
      </a>
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
            {!canSearch(query) && (
              <p className="text-muted p-3 text-sm">두 글자 이상 입력하세요.</p>
            )}
            {status === 'loading' && <p className="text-muted p-3 text-sm">검색 중…</p>}
            {status === 'error' && (
              <p className="p-3 text-sm text-red-700">검색 인덱스를 불러오지 못했습니다.</p>
            )}
            {canSearch(query) && status === 'idle' && results.length === 0 && (
              <Command.Empty className="text-muted p-3 text-sm">
                검색 결과가 없습니다.
              </Command.Empty>
            )}
            {results.map((result) => (
              <Command.Item key={result.url} value={result.meta.title} asChild>
                <a
                  href={result.url}
                  className="data-[selected=true]:bg-surface-sunken dark:data-[selected=true]:bg-surface-sunken block rounded px-3 py-2"
                >
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
    </>
  );
}
