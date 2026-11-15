/**
 * 라이브 프리뷰 (NOR-206 2단계). Obsidian 처럼 원본 문자는 그대로 두고, 커서가 없는 줄의 표시 문자만
 * 숨겨 렌더한 모양으로 보인다. 저장되는 것은 언제나 입력한 원본이다.
 *
 * 장식 계산(`previewDecorations`)은 DOM 없이 `EditorState` 만으로 하므로 단위 테스트할 수 있다.
 */
import { markdown, markdownLanguage as baseMarkdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
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
} from '@codemirror/view';

export interface PreviewItem {
  readonly from: number;
  readonly to: number;
  /** line: 줄 전체 클래스, mark: 구간 클래스, hide: 숨김 */
  readonly kind: 'line' | 'mark' | 'hide';
  readonly className?: string;
}

/** 목록 자동 이어쓰기 같은 입력 변경 키맵은 넣지 않는다. 입력한 글자가 그대로 원본이다(AC-8). */
export function markdownLanguage(): Extension {
  return markdown({ base: baseMarkdown, addKeymap: false });
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

export function previewDecorations(state: EditorState): PreviewItem[] {
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

  syntaxTree(state).iterate({
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
      if (name === 'ListMark') {
        items.push({ from: node.from, to: node.to, kind: 'mark', className: 'cm-lp-listmark' });
      }
      return;
    },
  });
  return items.flatMap((item) => (item.kind === 'hide' ? splitByLine(state, item) : [item]));
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

function toDecorations(state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  for (const item of previewDecorations(state)) {
    if (item.kind === 'line')
      ranges.push(Decoration.line({ class: item.className ?? '' }).range(item.from));
    else if (item.kind === 'mark' && item.to > item.from)
      ranges.push(Decoration.mark({ class: item.className ?? '' }).range(item.from, item.to));
    else if (item.kind === 'hide' && item.to > item.from)
      ranges.push(Decoration.replace({}).range(item.from, item.to));
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
      if (update.docChanged || update.selectionSet || update.viewportChanged)
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
    fontFamily: 'var(--font-serif)',
    fontSize: '1.875rem',
    color: 'var(--theme-foreground)',
  },
  '.cm-lp-h2': {
    fontFamily: 'var(--font-serif)',
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
  return [markdownLanguage(), livePreviewPlugin, theme, EditorView.lineWrapping];
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
  return { changes };
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
