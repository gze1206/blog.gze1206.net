import { useState } from 'react';

import { parseUnifiedDiff, toSideBySide, type DiffRow } from './diffRows.js';

type Mode = 'inline' | 'split';
const STORAGE_KEY = 'workbench.diffMode';

const MARK: Record<DiffRow['kind'], string> = {
  add: '+',
  del: '-',
  context: ' ',
  file: '',
  hunk: '',
  note: '',
};

function readMode(): Mode {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === 'split' ? 'split' : 'inline';
  } catch {
    return 'inline';
  }
}

function rowClass(kind: DiffRow['kind']): string {
  return `diff-row diff-${kind}`;
}

/**
 * 발행 검토 diff (NOR-217). git diff 처럼 줄 종류별로 칠하고, 인라인·나란히 보기를 바꿔 본다.
 * 고른 보기는 이 브라우저에 기억한다(못 쓰면 인라인).
 */
export function DiffView({ diff, label }: { readonly diff: string; readonly label: string }) {
  const [mode, setMode] = useState<Mode>(readMode);
  const rows = parseUnifiedDiff(diff);
  const choose = (next: Mode) => {
    setMode(next);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, next);
    } catch {
      // 저장하지 못해도 이번 화면에서는 바뀐다.
    }
  };
  return (
    <div className="mt-2">
      <div aria-label="diff 보기" className="mb-2 flex gap-1" role="group">
        {(
          [
            ['inline', '인라인'],
            ['split', '나란히'],
          ] as const
        ).map(([id, text]) => (
          <button
            aria-pressed={mode === id}
            className="rounded border border-border px-2.5 py-1 text-xs text-muted aria-pressed:bg-surface-sunken aria-pressed:text-foreground"
            key={id}
            onClick={() => choose(id)}
            type="button"
          >
            {text}
          </button>
        ))}
      </div>
      <div
        aria-label={label}
        className="diff-view max-h-[32rem] overflow-auto rounded-lg border border-border bg-surface font-mono text-xs"
        role="region"
      >
        {rows.length === 0 ? (
          <p className="p-4 text-muted">바뀐 것이 없습니다.</p>
        ) : mode === 'inline' ? (
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col className="w-12" />
              <col className="w-12" />
              <col />
            </colgroup>
            <tbody>
              {rows.map((row, index) => (
                <tr className={rowClass(row.kind)} key={index}>
                  <td className="diff-num">{row.oldLine ?? ''}</td>
                  <td className="diff-num">{row.newLine ?? ''}</td>
                  <td className="diff-text">
                    {MARK[row.kind]}
                    {row.text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col className="w-12" />
              <col />
              <col className="w-12" />
              <col />
            </colgroup>
            <tbody>
              {toSideBySide(rows).map((pair, index) =>
                pair.kind === 'pair' ? (
                  <tr key={index}>
                    <Side row={pair.left} side="old" />
                    <Side row={pair.right} side="new" />
                  </tr>
                ) : (
                  <tr className={rowClass(pair.kind)} key={index}>
                    <td className="diff-text" colSpan={4}>
                      {pair.row.text}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Side({ row, side }: { readonly row: DiffRow | null; readonly side: 'old' | 'new' }) {
  if (row === null)
    return (
      <>
        <td className="diff-num diff-empty" />
        <td className="diff-text diff-empty" />
      </>
    );
  const className = row.kind === 'context' ? 'diff-context' : `diff-${row.kind}`;
  return (
    <>
      <td className={`diff-num ${className}`}>{side === 'old' ? row.oldLine : row.newLine}</td>
      <td className={`diff-text ${className}`}>
        {MARK[row.kind]}
        {row.text}
      </td>
    </>
  );
}
