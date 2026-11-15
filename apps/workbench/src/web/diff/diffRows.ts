/**
 * 발행 검토의 unified diff 를 화면에 그릴 줄로 푼다 (NOR-217).
 *
 * 덩어리 머리(`@@ -a,b +c,d @@`)의 줄 수를 세어 본문과 그 밖을 가른다. 그래서 내용이 `--- ` 로 시작하는
 * 지운 줄을 파일 머리로 오해하지 않고, diff 뒤에 붙은 안내(예: 표지 교체)는 메모로 남는다.
 */
export type DiffRowKind = 'file' | 'hunk' | 'add' | 'del' | 'context' | 'note';

export interface DiffRow {
  readonly kind: DiffRowKind;
  /** 앞의 표시 문자(+·-·공백)를 뗀 내용. 머리·메모는 줄 전체다. */
  readonly text: string;
  readonly oldLine: number | null;
  readonly newLine: number | null;
}

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u;

export function parseUnifiedDiff(text: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldLine = 0;
  let newLine = 0;
  let oldLeft = 0;
  let newLeft = 0;
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  for (const line of lines) {
    if (oldLeft > 0 || newLeft > 0) {
      const mark = line[0];
      const body = line.slice(1);
      if (mark === '+' && newLeft > 0) {
        rows.push({ kind: 'add', text: body, oldLine: null, newLine });
        newLine += 1;
        newLeft -= 1;
        continue;
      }
      if (mark === '-' && oldLeft > 0) {
        rows.push({ kind: 'del', text: body, oldLine, newLine: null });
        oldLine += 1;
        oldLeft -= 1;
        continue;
      }
      if ((mark === ' ' || line === '') && oldLeft > 0 && newLeft > 0) {
        rows.push({ kind: 'context', text: body, oldLine, newLine });
        oldLine += 1;
        newLine += 1;
        oldLeft -= 1;
        newLeft -= 1;
        continue;
      }
      if (line.startsWith('\\')) {
        rows.push({ kind: 'note', text: line, oldLine: null, newLine: null });
        continue;
      }
    }
    const hunk = HUNK.exec(line);
    if (hunk) {
      oldLine = Number(hunk[1]);
      oldLeft = hunk[2] === undefined ? 1 : Number(hunk[2]);
      newLine = Number(hunk[3]);
      newLeft = hunk[4] === undefined ? 1 : Number(hunk[4]);
      rows.push({ kind: 'hunk', text: line, oldLine: null, newLine: null });
      continue;
    }
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      rows.push({ kind: 'file', text: line, oldLine: null, newLine: null });
      continue;
    }
    rows.push({ kind: 'note', text: line, oldLine: null, newLine: null });
  }
  return rows;
}

export type SideBySideRow =
  | { readonly kind: 'pair'; readonly left: DiffRow | null; readonly right: DiffRow | null }
  | { readonly kind: 'file' | 'hunk' | 'note'; readonly row: DiffRow };

/** 이어진 지운 줄·더한 줄을 차례로 짝지어 왼쪽(전)·오른쪽(후)에 둔다. */
export function toSideBySide(rows: readonly DiffRow[]): SideBySideRow[] {
  const result: SideBySideRow[] = [];
  let dels: DiffRow[] = [];
  let adds: DiffRow[] = [];
  const flush = () => {
    for (let index = 0; index < Math.max(dels.length, adds.length); index += 1)
      result.push({ kind: 'pair', left: dels[index] ?? null, right: adds[index] ?? null });
    dels = [];
    adds = [];
  };
  for (const row of rows) {
    if (row.kind === 'del') {
      // 더한 줄 뒤에 다시 지운 줄이 오면 새 묶음이다.
      if (adds.length > 0) flush();
      dels.push(row);
      continue;
    }
    if (row.kind === 'add') {
      adds.push(row);
      continue;
    }
    flush();
    if (row.kind === 'context') result.push({ kind: 'pair', left: row, right: row });
    else result.push({ kind: row.kind, row });
  }
  flush();
  return result;
}
