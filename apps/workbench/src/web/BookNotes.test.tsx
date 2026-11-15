import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BookNotes } from './BookNotes.js';

describe('BookNotes', () => {
  it('NOR-196 AC-16: 구절마다 공개 체크박스를 보여 준다', () => {
    const html = renderToStaticMarkup(
      <BookNotes
        documentId="doc"
        list="excerpts"
        items={[{ text: '문장' }]}
        onChanged={() => undefined}
        onError={() => undefined}
      />,
    );
    expect(html).toContain('공개');
    expect(html).toContain('type="checkbox"');
  });

  it('NOR-230 AC-5: 구절 메모 칸은 공개 구절이면 메모도 공개된다고 알린다', () => {
    const html = renderToStaticMarkup(
      <BookNotes
        documentId="doc"
        list="excerpts"
        items={[]}
        onChanged={() => undefined}
        onError={() => undefined}
      />,
    );
    expect(html).toContain('공개 구절이면 메모도 블로그에 함께 나갑니다');
  });
});
