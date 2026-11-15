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

it('NOR-196 AC-13: 책 내보내기 표지 메타데이터 경고를 표시한다', () => {
  const html = renderToStaticMarkup(
    <BookPublishReview
      review={{
        reviewId: 'id',
        kind: 'write',
        diff: '',
        targetPath: 'book.json',
        warnings: ['표지 메타데이터 경고'],
      }}
      cover="표지"
      busy={false}
      result={null}
      onClose={() => undefined}
      onConfirm={() => undefined}
    />,
  );
  expect(html).toContain('표지 메타데이터 경고');
});
