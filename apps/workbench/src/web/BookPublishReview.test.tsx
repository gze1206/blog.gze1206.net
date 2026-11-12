import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { BookPublishReview } from './BookPublishReview.js';

it('NOR-196 AC-16: 변경이 없으면 확정할 수 없다', () => {
  const html = renderToStaticMarkup(
    <BookPublishReview
      review={{ reviewId: 'id', kind: 'noop', diff: '', targetPath: 'book.json' }}
      cover="표지 없음"
      busy={false}
      result={null}
      onClose={() => undefined}
      onConfirm={() => undefined}
    />,
  );
  expect(html).toContain('바뀐 것 없음');
  expect(html).toMatch(/<button[^>]*disabled[^>]*>확정<\/button>/u);
});
