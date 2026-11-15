import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import type { EditorState, TransactionSpec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useRef } from 'react';

import {
  createSourceState,
  insertLink,
  livePreview,
  sourceOf,
  toggleLinePrefix,
  toggleWrap,
} from './livePreview.js';

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
  const loaded = useRef(false);
  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({ parent: host.current });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
      loaded.current = false;
    };
  }, []);

  // 바깥에서 원본이 바뀌면(다른 문서를 열면) 상태와 실행 취소 이력을 새로 만든다.
  // 자기 입력으로 바뀐 원본은 이미 같으므로 건드리지 않는다.
  useEffect(() => {
    const editor = view.current;
    if (!editor || (loaded.current && sourceOf(editor.state) === source)) return;
    loaded.current = true;
    editor.setState(
      createSourceState(source, [
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
          if (update.docChanged) changeRef.current(sourceOf(update.state));
        }),
      ]),
    );
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
