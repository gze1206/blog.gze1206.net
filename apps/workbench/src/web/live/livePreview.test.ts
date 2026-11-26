import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

const FRONT = '---\ntitle: 글\nkind: private-post\n---\n';
const BODY =
  '# 제목\n\n본문 **굵게** 와 `코드`\n\n> 인용\n\n{% callout type="tip" %}\n안내\n{% /callout %}\n\n끝';
const TEXT = FRONT + BODY;

interface Item {
  from: number;
  to: number;
  kind: string;
  className?: string;
}

async function decorate(cursor: number): Promise<Item[]> {
  const mod = await import('./livePreview.js');
  expect(mod).toHaveProperty('previewDecorations');
  const state = EditorState.create({
    doc: TEXT,
    selection: EditorSelection.cursor(cursor),
    extensions: [mod.markdownLanguage()],
  });
  return mod.previewDecorations(state);
}

const hidden = (items: Item[]) =>
  items.filter((item) => item.kind === 'hide').map((item) => TEXT.slice(item.from, item.to));
const lineClassAt = (items: Item[], offset: number) =>
  items
    .filter((item) => item.kind === 'line' && item.from === offset)
    .map((item) => item.className);

describe('라이브 프리뷰 장식', () => {
  it('NOR-206 AC-6: 커서가 없는 줄의 표시 문자는 숨기고 서식만 남긴다', async () => {
    const items = await decorate(TEXT.length);
    expect(hidden(items)).toEqual(expect.arrayContaining(['# ', '**', '`', '> ']));
    expect(lineClassAt(items, TEXT.indexOf('# 제목'))).toContain('cm-lp-h1');
    const strong = items.find((item) => item.className === 'cm-lp-strong');
    expect(strong && TEXT.slice(strong.from, strong.to)).toContain('굵게');
  });

  it('NOR-206 AC-6: 커서가 있는 줄은 원본을 그대로 보인다', async () => {
    const items = await decorate(TEXT.indexOf('제목'));
    expect(hidden(items)).not.toContain('# ');
    expect(lineClassAt(items, TEXT.indexOf('# 제목'))).toContain('cm-lp-h1');
  });

  it('NOR-206 AC-7: frontmatter 는 제목으로 해석하지 않고, Markdoc 태그 줄은 장식하지 않는다', async () => {
    const items = await decorate(TEXT.length);
    const frontLine = TEXT.indexOf('kind: private-post');
    expect(lineClassAt(items, frontLine)).toEqual(['cm-lp-frontmatter']);
    for (const item of items) {
      if (item.from < FRONT.length) expect(item.className ?? '').not.toMatch(/cm-lp-h\d/u);
    }
    const tagLine = TEXT.indexOf('{% callout');
    expect(lineClassAt(items, tagLine)).toEqual(['cm-lp-markdoc']);
    expect(
      items.some(
        (item) => item.kind === 'hide' && item.from >= tagLine && item.from < tagLine + 22,
      ),
    ).toBe(false);
  });
});

describe('서식 명령', () => {
  it('NOR-206 AC-8: 선택을 감싸고, 이미 감싼 선택이면 벗긴다', async () => {
    const mod = await import('./livePreview.js');
    expect(mod).toHaveProperty('toggleWrap');
    const at = (doc: string, from: number, to: number) =>
      EditorState.create({ doc, selection: EditorSelection.range(from, to) });
    const wrapped = at('가 나다 라', 2, 4).update(mod.toggleWrap(at('가 나다 라', 2, 4), '**'));
    expect(wrapped.state.doc.toString()).toBe('가 **나다** 라');
    const sel = wrapped.state.selection.main;
    const unwrapped = wrapped.state.update(mod.toggleWrap(wrapped.state, '**'));
    expect(sel.to - sel.from).toBe(2);
    expect(unwrapped.state.doc.toString()).toBe('가 나다 라');
  });
});

describe('원본 보존과 장식 범위', () => {
  it('NOR-206 AC-8: CRLF 원본은 편집기 상태를 거쳐도 그대로 돌아온다', async () => {
    const mod = await import('./livePreview.js');
    expect(mod).toHaveProperty('createSourceState');
    const source = '---\r\ntitle: 글\r\n---\r\n# 제목\r\n\r\n본문';
    const state = mod.createSourceState(source, []);
    expect(mod.sourceOf(state)).toBe(source);
    const edited = state.update({ changes: { from: state.doc.length, insert: '!' } }).state;
    expect(mod.sourceOf(edited)).toBe(`${source}!`);
    expect(mod.sourceOf(mod.createSourceState('가\n나', []))).toBe('가\n나');
  });

  it('NOR-206 AC-6: 숨김 범위는 줄을 넘지 않는다', async () => {
    const mod = await import('./livePreview.js');
    const doc = '[링크](https://example.com "첫 줄\n둘째 줄") 뒤\n\n끝';
    const state = EditorState.create({
      doc,
      selection: EditorSelection.cursor(doc.length),
      extensions: [mod.markdownLanguage()],
    });
    for (const item of mod.previewDecorations(state).filter((entry) => entry.kind === 'hide'))
      expect(state.doc.lineAt(item.from).number).toBe(state.doc.lineAt(item.to).number);
  });
});

describe('NOR-239 체크리스트', () => {
  const TASKS = '- [ ] 할 일\n- [x] 끝낸 일\n\n끝';
  async function tasks(cursor: number) {
    const mod = await import('./livePreview.js');
    const state = EditorState.create({
      doc: TASKS,
      selection: EditorSelection.cursor(cursor),
      extensions: [mod.markdownLanguage()],
    });
    return { mod, state, items: mod.previewDecorations(state) as Item[] };
  }

  it('NOR-239 AC-1: 커서가 없는 줄의 작업 표시는 체크박스로, 끝낸 줄은 완료 클래스를 붙인다', async () => {
    const { items } = await tasks(TASKS.length);
    const boxes = items.filter((item) => item.kind === 'task');
    expect(boxes.map((item) => TASKS.slice(item.from, item.to))).toEqual(['[ ]', '[x]']);
    expect(boxes.map((item) => (item as Item & { checked?: boolean }).checked)).toEqual([
      false,
      true,
    ]);
    const done = items.filter(
      (item) => item.kind === 'line' && item.className === 'cm-lp-task-done',
    );
    expect(done.map((item) => item.from)).toEqual([TASKS.indexOf('- [x]')]);
    // 커서가 있는 줄은 원본을 보인다.
    const active = await tasks(3);
    expect(
      active.items
        .filter((item) => item.kind === 'task')
        .map((item) => TASKS.slice(item.from, item.to)),
    ).toEqual(['[x]']);
  });

  it('NOR-239 AC-2: toggleTask 는 작업 표시를 바꾸고 작업이 아니면 그대로 둔다', async () => {
    const { mod, state } = await tasks(TASKS.length);
    expect(mod).toHaveProperty('toggleTask');
    const apply = (doc: string, pos: number) => {
      const current = EditorState.create({ doc, extensions: [mod.markdownLanguage()] });
      return current.update(mod.toggleTask(current, pos)).state.doc.toString();
    };
    expect(apply(TASKS, 2)).toBe(TASKS.replace('- [ ] 할 일', '- [x] 할 일'));
    expect(apply(TASKS, TASKS.indexOf('[x]'))).toBe(TASKS.replace('[x]', '[ ]'));
    expect(apply('- [X] 대문자', 2)).toBe('- [ ] 대문자');
    expect(apply(TASKS, TASKS.lastIndexOf('끝'))).toBe(TASKS);
    expect(state.doc.toString()).toBe(TASKS);
  });
});

it('NOR-239 AC-1: 커서가 없는 작업 줄은 목록 기호를 숨긴다', async () => {
  const mod = await import('./livePreview.js');
  const doc = '- [ ] 할 일\n- 그냥\n\n끝';
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(doc.length),
    extensions: [mod.markdownLanguage()],
  });
  const hiddenText = (mod.previewDecorations(state) as Item[])
    .filter((item) => item.kind === 'hide')
    .map((item) => doc.slice(item.from, item.to));
  expect(hiddenText).toEqual(['- ']);
});

it('NOR-240 AC-3: 커서가 없는 줄의 wb 주석만 숨긴다', async () => {
  const mod = await import('./livePreview.js');
  const doc =
    '- □ 할 일 <!-- wb:id=01M83945Q72TNSZD8E69SVBWME -->\n- 메모 <!-- 내가 쓴 주석 -->\n\n끝';
  const at = (cursor: number) => {
    const state = EditorState.create({
      doc,
      selection: EditorSelection.cursor(cursor),
      extensions: [mod.markdownLanguage()],
    });
    return (mod.previewDecorations(state) as Item[])
      .filter((item) => item.kind === 'hide')
      .map((item) => doc.slice(item.from, item.to));
  };
  expect(at(doc.length)).toEqual([' <!-- wb:id=01M83945Q72TNSZD8E69SVBWME -->']);
  expect(at(2)).toEqual([]);
});

it('NOR-244 AC-3: 목록 항목 줄에 깊이 클래스를 붙이고 커서 없는 하위 항목의 앞 공백을 숨긴다', async () => {
  const mod = await import('./livePreview.js');
  const doc = '- 상위\n  - 하위\n    - 더 하위\n\n끝';
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(doc.length),
    extensions: [mod.markdownLanguage()],
  });
  const items = mod.previewDecorations(state) as Item[];
  const depth = (line: string) =>
    items
      .filter((item) => item.kind === 'line' && item.from === doc.indexOf(line))
      .map((item) => item.className);
  expect(depth('- 상위')).toContain('cm-lp-li-1');
  expect(depth('  - 하위')).toContain('cm-lp-li-2');
  expect(depth('    - 더 하위')).toContain('cm-lp-li-3');
  const hidden = items
    .filter((item) => item.kind === 'hide')
    .map((item) => doc.slice(item.from, item.to));
  expect(hidden).toEqual(['  ', '    ']);
  // 커서가 있는 줄은 원본 공백을 보인다.
  const active = EditorState.create({
    doc,
    selection: EditorSelection.cursor(doc.indexOf('하위')),
    extensions: [mod.markdownLanguage()],
  });
  expect(
    (mod.previewDecorations(active) as Item[])
      .filter((item) => item.kind === 'hide')
      .map((item) => doc.slice(item.from, item.to)),
  ).toEqual(['    ']);
});
