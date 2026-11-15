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
