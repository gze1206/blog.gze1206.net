import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { renderPreview } from '../../core/preview/render.js';
import { BLOCKS, insertBlock } from './blocks.js';

describe('커스텀 블록 메뉴 (NOR-229)', () => {
  it('NOR-229 AC-3: bookquote 를 뺀 틀은 미리보기에서 경고 없이 렌더된다', () => {
    const names = BLOCKS.map((block) => block.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'callout',
        'bookmark',
        'github',
        'youtube',
        'video',
        'figure',
        'math',
        'mathblock',
        'bookquote',
      ]),
    );
    for (const block of BLOCKS) {
      if (block.name === 'bookquote') {
        expect(block.snippet).toMatch(/^\{% bookquote book="[^"]+" excerpt="[^"]+" \/%\}$/u);
        continue;
      }
      expect(renderPreview(`${block.snippet}\n`).warnings, block.name).toEqual([]);
    }
  });

  it('NOR-229 AC-4: 커서 줄 아래에 새 단락으로 넣고 첫 자리 표시 값을 선택한다', () => {
    const callout = BLOCKS.find((block) => block.name === 'callout');
    expect(callout).toBeDefined();
    if (!callout) return;
    const state = EditorState.create({ doc: '첫 줄\n둘째 줄', selection: { anchor: 2 } });
    const next = state.update(insertBlock(state, callout)).state;
    const text = next.doc.toString();
    expect(text.startsWith(`첫 줄\n\n${callout.snippet}\n\n둘째 줄`)).toBe(true);
    const selected = next.sliceDoc(next.selection.main.from, next.selection.main.to);
    expect(selected).toBe(callout.placeholder);

    const empty = EditorState.create({ doc: '위\n\n아래', selection: { anchor: 2 } });
    const inserted = empty.update(insertBlock(empty, callout)).state.doc.toString();
    expect(inserted).toBe(`위\n${callout.snippet}\n\n아래`);
  });
});
