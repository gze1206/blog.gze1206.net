/**
 * 라이브 프리뷰 (NOR-206 2단계). Obsidian 처럼 원본 문자는 그대로 두고, 커서가 없는 줄의 표시 문자만
 * 숨겨 렌더한 모양으로 보인다. 저장되는 것은 언제나 입력한 원본이다.
 *
 * 장식 계산(`previewDecorations`)은 DOM 없이 `EditorState` 만으로 하므로 단위 테스트할 수 있다.
 */
import { markdown, markdownLanguage as baseMarkdown } from '@codemirror/lang-markdown';
import { ensureSyntaxTree, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import {
  EditorSelection,
  EditorState,
  type Extension,
  type Range,
  type TransactionSpec,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';

import { codeLanguage } from './codeHighlight.js';

export interface PreviewItem {
  readonly from: number;
  readonly to: number;
  /** line: 줄 전체 클래스, mark: 구간 클래스, hide: 숨김, task: 작업 표시를 체크박스로(NOR-239) */
  readonly kind: 'line' | 'mark' | 'hide' | 'task';
  readonly className?: string;
  /** task 만: 끝낸 작업인지. */
  readonly checked?: boolean;
  /** task 만: 체크박스의 접근 가능한 이름(작업 글). */
  readonly label?: string;
}

/** 목록 자동 이어쓰기 같은 입력 변경 키맵은 넣지 않는다. 입력한 글자가 그대로 원본이다(AC-8). */
export function markdownLanguage(): Extension {
  // 코드 블록 안의 언어도 파싱한다(NOR-229). 언어 파서는 처음 쓸 때 불러온다.
  return markdown({ base: baseMarkdown, addKeymap: false, codeLanguages: codeLanguage });
}

/** 맨 앞 YAML frontmatter 가 끝나는 위치. 없으면 0. */
export function frontmatterEnd(text: string): number {
  const match = /^---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(\r?\n|$)/u.exec(text);
  return match ? match[0].length : 0;
}

const MARK_CLASS: Record<string, string> = {
  StrongEmphasis: 'cm-lp-strong',
  Emphasis: 'cm-lp-em',
  InlineCode: 'cm-lp-code',
  Link: 'cm-lp-link',
  Strikethrough: 'cm-lp-strike',
};

/**
 * `ensureMs` 만큼 기다려 문서 끝까지 구문 트리를 확보한다. 편집기는 0 을 넘겨 입력을 막지 않고,
 * 배경 파싱으로 트리가 바뀌면 다시 계산한다.
 */
export function previewDecorations(state: EditorState, ensureMs = 200): PreviewItem[] {
  const doc = state.doc;
  const text = doc.toString();
  const items: PreviewItem[] = [];
  const activeLines = new Set<number>();
  for (const range of state.selection.ranges) {
    for (let line = doc.lineAt(range.from).number; line <= doc.lineAt(range.to).number; line += 1)
      activeLines.add(line);
  }
  const lineOf = (pos: number) => doc.lineAt(pos);
  const isActive = (pos: number) => activeLines.has(lineOf(pos).number);

  // frontmatter 는 Markdown 이 아니다. `---` 를 제목 밑줄로 오해하지 않게 따로 다룬다(AC-7).
  const fmEnd = frontmatterEnd(text);
  if (fmEnd > 0) {
    for (let pos = 0; pos < fmEnd;) {
      const line = lineOf(pos);
      items.push({ from: line.from, to: line.from, kind: 'line', className: 'cm-lp-frontmatter' });
      pos = line.to + 1;
    }
  }

  // Markdoc 태그 줄은 장식하지 않는다(AC-7).
  const markdocLines = new Set<number>();
  for (let n = lineOf(Math.min(fmEnd, doc.length)).number; n <= doc.lines; n += 1) {
    const line = doc.line(n);
    if (line.from < fmEnd) continue;
    if (/^\s*\{%/u.test(line.text)) {
      markdocLines.add(n);
      items.push({ from: line.from, to: line.from, kind: 'line', className: 'cm-lp-markdoc' });
    }
  }
  const skip = (pos: number) => pos < fmEnd || markdocLines.has(lineOf(pos).number);

  /** 표시 문자와, 뒤따르는 공백 하나를 함께 숨긴다(`# `, `> `). */
  const hideWithSpace = (from: number, to: number) => {
    const end = text[to] === ' ' ? to + 1 : to;
    if (!isActive(from)) items.push({ from, to: end, kind: 'hide' });
  };

  // 파서는 시간 예산 안에서만 트리를 만든다. 덜 된 트리로 계산하면 뒤쪽 장식이 빠진다.
  const tree =
    (ensureMs > 0 ? ensureSyntaxTree(state, state.doc.length, ensureMs) : null) ??
    syntaxTree(state);
  tree.iterate({
    from: fmEnd,
    enter(node) {
      if (node.from < fmEnd || skip(node.from)) return;
      const name = node.name;
      const heading = /^ATXHeading([1-6])$/u.exec(name);
      if (heading) {
        const line = lineOf(node.from);
        items.push({
          from: line.from,
          to: line.from,
          kind: 'line',
          className: `cm-lp-h${heading[1]}`,
        });
        return;
      }
      if (name === 'HeaderMark') {
        if (node.node.parent?.name.startsWith('ATXHeading')) hideWithSpace(node.from, node.to);
        return;
      }
      if (name === 'Blockquote') {
        for (let pos = node.from; pos <= node.to;) {
          const line = lineOf(pos);
          if (!skip(line.from))
            items.push({ from: line.from, to: line.from, kind: 'line', className: 'cm-lp-quote' });
          pos = line.to + 1;
        }
        return;
      }
      if (name === 'QuoteMark') {
        hideWithSpace(node.from, node.to);
        return;
      }
      if (name === 'FencedCode') {
        for (let pos = node.from; pos <= node.to;) {
          const line = lineOf(pos);
          items.push({
            from: line.from,
            to: line.from,
            kind: 'line',
            className: 'cm-lp-codeblock',
          });
          pos = line.to + 1;
        }
        return false;
      }
      const markClass = MARK_CLASS[name];
      if (markClass) {
        items.push({ from: node.from, to: node.to, kind: 'mark', className: markClass });
        return;
      }
      if (name === 'EmphasisMark' || name === 'StrikethroughMark') {
        if (!isActive(node.from)) items.push({ from: node.from, to: node.to, kind: 'hide' });
        return;
      }
      if (name === 'CodeMark' && node.node.parent?.name === 'InlineCode') {
        if (!isActive(node.from)) items.push({ from: node.from, to: node.to, kind: 'hide' });
        return;
      }
      if (
        (name === 'LinkMark' || name === 'URL' || name === 'LinkTitle') &&
        node.node.parent?.name === 'Link'
      ) {
        if (!isActive(node.from)) items.push({ from: node.from, to: node.to, kind: 'hide' });
        return;
      }
      if (name === 'Task') {
        const marker = node.node.getChild('TaskMarker');
        if (marker === null) return;
        const checked = /x/iu.test(text.slice(marker.from, marker.to));
        if (checked)
          items.push({
            from: lineOf(node.from).from,
            to: lineOf(node.from).from,
            kind: 'line',
            className: 'cm-lp-task-done',
          });
        if (!isActive(marker.from))
          items.push({
            from: marker.from,
            to: marker.to,
            kind: 'task',
            checked,
            label: text.slice(marker.to, lineOf(node.from).to).trim(),
          });
        return;
      }
      if (name === 'ListMark') {
        // 작업 항목은 체크박스가 표시를 맡으므로 목록 기호를 숨긴다(NOR-239).
        if (node.node.parent?.getChild('Task') && !isActive(node.from)) {
          hideWithSpace(node.from, node.to);
          return;
        }
        items.push({ from: node.from, to: node.to, kind: 'mark', className: 'cm-lp-listmark' });
      }
      return;
    },
  });
  return items
    .flatMap((item) => (item.kind === 'hide' ? splitByLine(state, item) : [item]))
    .sort((a, b) => a.from - b.from);
}

/** 줄을 넘는 숨김은 ViewPlugin 장식으로 둘 수 없다. 줄마다 나눈다. */
function splitByLine(state: EditorState, item: PreviewItem): PreviewItem[] {
  const parts: PreviewItem[] = [];
  for (let pos = item.from; pos < item.to;) {
    const line = state.doc.lineAt(pos);
    const to = Math.min(item.to, line.to);
    if (to > pos) parts.push({ from: pos, to, kind: 'hide' });
    pos = line.to + 1;
  }
  return parts;
}

/** 원본의 줄바꿈 형식(CRLF/LF)을 그대로 지키는 편집기 상태를 만든다. */
export function createSourceState(source: string, extensions: Extension): EditorState {
  return EditorState.create({
    doc: source,
    extensions: [source.includes('\r\n') ? EditorState.lineSeparator.of('\r\n') : [], extensions],
  });
}

/** 편집기 상태를 저장할 원본 문자열로 되돌린다. */
export function sourceOf(state: EditorState): string {
  return state.doc.sliceString(0, state.doc.length, state.lineBreak);
}

/**
 * 작업 표시 자리의 체크박스(NOR-239). 누르면 원본의 `[ ]`·`[x]` 를 바꾼다.
 * 편집기가 누르기를 받으면 커서가 그 줄로 옮겨 가 체크박스가 원본으로 바뀌므로, 이벤트는 위젯이 받는다.
 */
class TaskWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly label: string,
  ) {
    super();
  }
  override eq(other: TaskWidget): boolean {
    return other.checked === this.checked && other.label === this.label;
  }
  override toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = this.checked;
    box.className = 'cm-lp-task';
    box.setAttribute('aria-label', this.label || '할 일');
    box.addEventListener('mousedown', (event) => event.preventDefault());
    box.addEventListener('click', (event) => {
      event.preventDefault();
      view.dispatch(toggleTask(view.state, view.posAtDOM(box)));
    });
    return box;
  }
  override ignoreEvent(): boolean {
    return true;
  }
}

function toDecorations(state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  for (const item of previewDecorations(state, 0)) {
    if (item.kind === 'line')
      ranges.push(Decoration.line({ class: item.className ?? '' }).range(item.from));
    else if (item.kind === 'mark' && item.to > item.from)
      ranges.push(Decoration.mark({ class: item.className ?? '' }).range(item.from, item.to));
    else if (item.kind === 'hide' && item.to > item.from)
      ranges.push(Decoration.replace({}).range(item.from, item.to));
    else if (item.kind === 'task')
      ranges.push(
        Decoration.replace({
          widget: new TaskWidget(item.checked === true, item.label ?? ''),
        }).range(item.from, item.to),
      );
  }
  return Decoration.set(ranges, true);
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = toDecorations(view.state);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      )
        this.decorations = toDecorations(update.state);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--theme-background)', color: 'var(--theme-body)' },
  '.cm-scroller': { fontFamily: 'var(--font-sans)', lineHeight: '1.9', padding: '1.5rem 0' },
  '.cm-content': { padding: '0 1.5rem', maxWidth: '52rem', caretColor: 'var(--theme-foreground)' },
  '.cm-line': { padding: '0' },
  '&.cm-focused': { outline: 'none' },
  '.cm-lp-h1': {
    fontFamily: 'var(--font-bold tracking-[-0.02em])',
    fontSize: '1.875rem',
    color: 'var(--theme-foreground)',
  },
  '.cm-lp-h2': {
    fontFamily: 'var(--font-bold tracking-[-0.02em])',
    fontSize: '1.5rem',
    color: 'var(--theme-foreground)',
  },
  '.cm-lp-h3': { fontSize: '1.2rem', fontWeight: '600', color: 'var(--theme-foreground)' },
  '.cm-lp-h4, .cm-lp-h5, .cm-lp-h6': { fontWeight: '600', color: 'var(--theme-foreground)' },
  '.cm-lp-strong': { fontWeight: '700', color: 'var(--theme-foreground)' },
  '.cm-lp-em': { fontStyle: 'italic' },
  '.cm-lp-strike': { textDecoration: 'line-through' },
  '.cm-lp-code': {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.9em',
    backgroundColor: 'var(--theme-surface-sunken)',
    borderRadius: '0.25rem',
  },
  '.cm-lp-link': { color: 'var(--theme-accent)', textDecoration: 'underline' },
  '.cm-lp-listmark': { color: 'var(--theme-accent)' },
  '.cm-lp-task': {
    accentColor: 'var(--theme-accent)',
    width: '1.05em',
    height: '1.05em',
    margin: '0 0.15em',
    verticalAlign: '-0.15em',
    cursor: 'pointer',
  },
  '.cm-lp-task-done': { color: 'var(--theme-muted)', textDecoration: 'line-through' },
  '.cm-lp-quote': {
    borderLeft: '2px solid var(--theme-border-strong)',
    paddingLeft: '0.75rem !important',
    color: 'var(--theme-muted-strong)',
  },
  '.cm-lp-codeblock': {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875rem',
    backgroundColor: 'var(--theme-surface-sunken)',
  },
  '.cm-lp-frontmatter': {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    color: 'var(--theme-muted)',
  },
  '.cm-lp-markdoc': {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875rem',
    color: 'var(--theme-accent)',
  },
});

/** 라이브 프리뷰 편집기에 필요한 확장 전부. */
export function livePreview(): Extension {
  return [
    markdownLanguage(),
    livePreviewPlugin,
    theme,
    // 코드 토큰에 tok-* 클래스를 붙인다. 색은 styles.css 의 .tok-* 가 정한다(NOR-229).
    syntaxHighlighting(classHighlighter),
    EditorView.lineWrapping,
  ];
}

/** 선택을 `marker` 로 감싼다. 이미 감싼 선택이면 벗긴다(AC-8). */
export function toggleWrap(state: EditorState, marker: string): TransactionSpec {
  const size = marker.length;
  return state.changeByRange((range) => {
    const before = state.sliceDoc(range.from - size, range.from);
    const after = state.sliceDoc(range.to, range.to + size);
    if (before === marker && after === marker) {
      return {
        changes: [
          { from: range.from - size, to: range.from, insert: '' },
          { from: range.to, to: range.to + size, insert: '' },
        ],
        range: EditorSelection.range(range.from - size, range.to - size),
      };
    }
    return {
      changes: [
        { from: range.from, insert: marker },
        { from: range.to, insert: marker },
      ],
      range: EditorSelection.range(range.from + size, range.to + size),
    };
  });
}

/** 선택한 줄마다 앞에 `prefix` 를 붙이거나, 이미 있으면 뗀다(제목·목록·인용). */
export function toggleLinePrefix(state: EditorState, prefix: string): TransactionSpec {
  const changes: { from: number; to?: number; insert: string }[] = [];
  const seen = new Set<number>();
  for (const range of state.selection.ranges) {
    for (
      let n = state.doc.lineAt(range.from).number;
      n <= state.doc.lineAt(range.to).number;
      n += 1
    ) {
      if (seen.has(n)) continue;
      seen.add(n);
      const line = state.doc.line(n);
      if (line.text.startsWith(prefix))
        changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
      else changes.push({ from: line.from, insert: prefix });
    }
  }
  // 줄 맨 앞의 커서는 붙인 표시 뒤로 보낸다. 그대로 두면 이어 친 글자가 표시 앞에 들어간다(NOR-239).
  const changeSet = state.changes(changes);
  return { changes: changeSet, selection: state.selection.map(changeSet, 1) };
}

/** 선택을 링크로 만든다. 주소 자리를 선택해 바로 칠 수 있게 한다. */
export function insertLink(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const label = state.sliceDoc(range.from, range.to) || '링크';
    const insert = `[${label}](https://)`;
    const urlStart = range.from + label.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(urlStart, urlStart + 8),
    };
  });
}

const TASK_LINE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/u;

/** `pos` 가 있는 줄의 작업 표시를 `[ ]` ↔ `[x]` 로 바꾼다(NOR-239). 작업 줄이 아니면 바꾸지 않는다. */
export function toggleTask(state: EditorState, pos: number): TransactionSpec {
  const line = state.doc.lineAt(pos);
  const match = TASK_LINE.exec(line.text);
  if (match?.[1] === undefined || match[2] === undefined) return {};
  const at = line.from + match[1].length + 1;
  return { changes: { from: at, to: at + 1, insert: match[2] === ' ' ? 'x' : ' ' } };
}
