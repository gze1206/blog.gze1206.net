import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
  indentWithTab,
} from '@codemirror/commands';
import { deleteMarkupBackward } from '@codemirror/lang-markdown';
import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useRef, useState } from 'react';

import {
  continueMarkup,
  createSourceState,
  insertLink,
  livePreview,
  sourceOf,
  toggleLinePrefix,
  toggleWrap,
} from './livePreview.js';
import { BLOCKS, insertBlock } from './blocks.js';

type Command = (state: EditorState) => TransactionSpec;

const TOOLS: readonly { label: string; text: string; run: Command }[] = [
  { label: '굵게', text: 'B', run: (state) => toggleWrap(state, '**') },
  { label: '기울임', text: 'I', run: (state) => toggleWrap(state, '*') },
  { label: '제목', text: 'H', run: (state) => toggleLinePrefix(state, '## ') },
  { label: '목록', text: '•', run: (state) => toggleLinePrefix(state, '- ') },
  { label: '체크리스트', text: '☐', run: (state) => toggleLinePrefix(state, '- [ ] ') },
  { label: '인용', text: '❝', run: (state) => toggleLinePrefix(state, '> ') },
  { label: '코드', text: '</>', run: (state) => toggleWrap(state, '`') },
  { label: '링크', text: '🔗', run: insertLink },
];

/** 화상 키보드에는 Tab 이 없다. 중첩 목록을 만들 수 있게 버튼으로도 둔다(NOR-238 AC-3). */
const VIEW_TOOLS: readonly { label: string; text: string; run: (view: EditorView) => boolean }[] = [
  { label: '내어쓰기', text: '⇤', run: indentLess },
  { label: '들여쓰기', text: '⇥', run: indentMore },
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
  /** 본문 이미지를 올리고 본문에 넣을 경로를 돌려준다(NOR-219 AC-6). 없으면 버튼을 두지 않는다. */
  readonly onUploadImage?: (file: File) => Promise<string>;
  readonly onError?: (message: string) => void;
}

/** 라이브 프리뷰 Markdown 편집기(NOR-206 AC-6~9). 저장하는 값은 원본 그대로다. */
export function LiveEditor({ source, onChange, className = '', onUploadImage, onError }: Props) {
  const [uploading, setUploading] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changeRef = useRef(onChange);
  const loaded = useRef(false);
  /** 바깥 원본으로 상태를 새로 만들 때마다(다른 문서) 오른다. 늦게 끝난 올리기를 가려낸다. */
  const generation = useRef(0);
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
    generation.current += 1;
    editor.setState(
      createSourceState(source, [
        history(),
        keymap.of([
          // 목록·체크리스트는 Enter 로 이어 쓰고, 빈 항목에서 끝낸다(NOR-245). 목록이 아니면 기본 줄바꿈이 받는다.
          { key: 'Enter', run: continueMarkup },
          { key: 'Backspace', run: deleteMarkupBackward },
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
        className="border-border relative flex gap-1 overflow-x-auto border-b px-4 py-1.5"
        role="toolbar"
      >
        {[...TOOLS.map((tool) => ({ ...tool, run: runner(tool.run) })), ...VIEW_TOOLS].map(
          (tool) => (
            <button
              aria-label={tool.label}
              className="text-muted hover:bg-surface-sunken hover:text-foreground min-h-10 min-w-10 shrink-0 rounded px-2 py-1 text-xs md:min-h-0 md:min-w-8"
              key={tool.label}
              onClick={() => {
                const editor = view.current;
                if (!editor) return;
                tool.run(editor);
                editor.focus();
              }}
              onMouseDown={(event) => event.preventDefault()}
              title={tool.label}
              type="button"
            >
              {tool.text}
            </button>
          ),
        )}
        <select
          aria-label="블록 넣기"
          className="text-muted hover:bg-surface-sunken hover:text-foreground rounded bg-transparent px-2 py-1 text-xs"
          onChange={(event) => {
            const block = BLOCKS.find((item) => item.name === event.target.value);
            event.target.value = '';
            const editor = view.current;
            if (!block || !editor) return;
            editor.dispatch(insertBlock(editor.state, block));
            editor.focus();
          }}
          value=""
        >
          <option disabled value="">
            블록
          </option>
          {BLOCKS.map((block) => (
            <option key={block.name} value={block.name}>
              {block.label}
            </option>
          ))}
        </select>
        {onUploadImage ? (
          <label className="text-muted hover:bg-surface-sunken hover:text-foreground cursor-pointer rounded px-2 py-1 text-xs">
            {uploading ? '올리는 중…' : '이미지'}
            <input
              accept="image/png,image/jpeg,image/webp"
              aria-label="본문 이미지 파일"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                const editor = view.current;
                if (!file || !editor) return;
                const started = generation.current;
                setUploading(true);
                onUploadImage(file)
                  .then((reference) => {
                    // 올리는 사이 다른 문서로 바뀌었으면 넣지 않는다.
                    if (generation.current !== started || view.current !== editor) {
                      onError?.('올리는 사이 문서가 바뀌어 이미지를 본문에 넣지 않았습니다.');
                      return;
                    }
                    const at = editor.state.selection.main;
                    const insert = `![설명](${reference})`;
                    editor.dispatch({
                      changes: { from: at.from, to: at.to, insert },
                      // 설명 자리를 골라 두어 바로 고쳐 쓸 수 있게 한다.
                      selection: EditorSelection.range(at.from + 2, at.from + 4),
                    });
                    editor.focus();
                  })
                  .catch((cause: unknown) =>
                    onError?.(
                      cause instanceof Error ? cause.message : '이미지를 올리지 못했습니다.',
                    ),
                  )
                  .finally(() => setUploading(false));
              }}
              type="file"
            />
          </label>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden" ref={host} />
    </div>
  );
}
