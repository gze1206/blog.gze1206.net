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
});
