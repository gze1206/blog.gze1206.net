/**
 * 블로그 커스텀 블록(Markdoc 태그) 틀 (NOR-229). 속성은 블로그의 markdoc.config.mjs 와 같다.
 *
 * `placeholder` 는 틀 안에서 먼저 고쳐야 할 값이다. 넣은 뒤 그 값을 선택해 바로 덮어 쓰게 한다.
 */
import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state';

export interface Block {
  readonly name: string;
  readonly label: string;
  readonly snippet: string;
  readonly placeholder: string;
}

export const BLOCKS: readonly Block[] = [
  {
    name: 'callout',
    label: '강조 상자(callout)',
    snippet: '{% callout type="note" title="제목" %}\n내용\n{% /callout %}',
    placeholder: '제목',
  },
  {
    name: 'bookmark',
    label: '링크 카드(bookmark)',
    snippet: '{% bookmark url="https://example.com" /%}',
    placeholder: 'https://example.com',
  },
  {
    name: 'github',
    label: 'GitHub 저장소(github)',
    snippet: '{% github repo="owner/name" /%}',
    placeholder: 'owner/name',
  },
  {
    name: 'youtube',
    label: 'YouTube(youtube)',
    snippet: '{% youtube id="VIDEO_ID" title="영상 제목" /%}',
    placeholder: 'VIDEO_ID',
  },
  {
    name: 'video',
    label: '동영상(video)',
    snippet: '{% video src="/assets/posts/slug/video.mp4" title="영상 제목" /%}',
    placeholder: '/assets/posts/slug/video.mp4',
  },
  {
    name: 'figure',
    label: '그림과 설명(figure)',
    snippet: '{% figure caption="설명" %}\n![대체 텍스트](images/example.png)\n{% /figure %}',
    placeholder: '설명',
  },
  {
    name: 'math',
    label: '수식, 줄 안(math)',
    snippet: '{% math formula="E = mc^2" /%}',
    placeholder: 'E = mc^2',
  },
  {
    name: 'mathblock',
    label: '수식, 블록(mathblock)',
    snippet: '{% mathblock formula="\\\\int_0^1 x\\\\,dx" /%}',
    placeholder: '\\\\int_0^1 x\\\\,dx',
  },
  {
    name: 'bookquote',
    label: '책 구절(bookquote)',
    // 실제 id 는 책 노트의 "인용 복사" 로 받는 편이 정확하다.
    snippet: '{% bookquote book="책-id" excerpt="구절-id" /%}',
    placeholder: '책-id',
  },
];

/** 커서 줄 아래에 빈 줄로 띄운 새 단락으로 넣는다. 빈 줄에서는 그 자리에 넣는다. */
export function insertBlock(state: EditorState, block: Block): TransactionSpec {
  const line = state.doc.lineAt(state.selection.main.head);
  const blank = line.text.trim() === '';
  // 빈 줄이면 그 줄을 틀로 바꾸고, 아니면 줄 끝 뒤에 빈 줄을 하나 두고 넣는다. 어느 쪽이든 뒤 단락과 띄운다.
  const from = blank ? line.from : line.to;
  const prefix = blank ? '' : '\n\n';
  const insert = `${prefix}${block.snippet}\n`;
  const offset = from + prefix.length + block.snippet.indexOf(block.placeholder);
  return {
    changes: { from, to: line.to, insert },
    selection: EditorSelection.range(offset, offset + block.placeholder.length),
    scrollIntoView: true,
  };
}
