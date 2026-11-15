import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { EditorState, type TransactionSpec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useRef } from 'react';

import { insertLink, livePreview, toggleLinePrefix, toggleWrap } from './livePreview.js';

type Command = (state: EditorState) => TransactionSpec;

const TOOLS: readonly { label: string; text: string; run: Command }[] = [
  { label: '굵게', text: 'B', run: (state) => toggleWrap(state, '**') },
  { label: '기울임', text: 'I', run: (state) => toggleWrap(state, '*') },
  { label: '제목', text: 'H', run: (state) => toggleLinePrefix(state, '## ') },
  { label: '목록', text: '•', run: (state) => toggleLinePrefix(state, '- ') },
  { label: '인용', text: '❝', run: (state) => toggleLinePrefix(state, '> ') },
  { label: '코드', text: '</>', run: (state) => toggleWrap(state, '`') },
  { label: '링크', text: '🔗', run: insertLink },
];

function runner(command: Command) {
  return (view: EditorView) => {
    view.dispatch(command(view.state));
    return true;
  };
}

interface Props {
  readonly source: string;
  readonly onChange: (source: string) => void;
  readonly className?: string;
}

/** 라이브 프리뷰 Markdown 편집기(NOR-206 AC-6~9). 저장하는 값은 원본 그대로다. */
export function LiveEditor({ source, onChange, className = '' }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: source,
        extensions: [
          history(),
          keymap.of([
            { key: 'Mod-b', run: runner((state) => toggleWrap(state, '**')) },
            { key: 'Mod-i', run: runner((state) => toggleWrap(state, '*')) },
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          livePreview(),
          EditorView.contentAttributes.of({ 'aria-label': 'Markdown 문서', spellcheck: 'false' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // 편집기는 한 번만 만든다. 바깥에서 바뀐 원본은 아래 효과가 맞춘다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current !== source)
      editor.dispatch({ changes: { from: 0, to: current.length, insert: source } });
  }, [source]);

  return (
    <div className={`flex min-h-0 min-w-0 flex-col ${className}`}>
      <div
        aria-label="서식"
        className="border-border flex gap-1 border-b px-4 py-1.5"
        role="toolbar"
      >
        {TOOLS.map((tool) => (
          <button
            aria-label={tool.label}
            className="text-muted hover:bg-surface-sunken hover:text-foreground min-w-8 rounded px-2 py-1 text-xs"
            key={tool.label}
            onClick={() => {
              const editor = view.current;
              if (!editor) return;
              runner(tool.run)(editor);
              editor.focus();
            }}
            onMouseDown={(event) => event.preventDefault()}
            title={tool.label}
            type="button"
          >
            {tool.text}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden" ref={host} />
    </div>
  );
}
