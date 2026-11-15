import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import { DocumentList } from './DocumentList.js';

it('NOR-228 AC-6: 상태를 불러오는 동안 공개 글에 확인 중 배지를 둔다', () => {
  const documents = [
    {
      id: 'p',
      relativePath: 'drafts/p.md',
      label: 'p',
      title: '공개 글',
      kind: 'public-draft',
      updatedAt: '2026-11-15',
    },
    {
      id: 'n',
      relativePath: 'notes/n.md',
      label: 'n',
      title: '메모',
      kind: 'note',
      updatedAt: '2026-11-15',
    },
  ];
  const render = (loading: boolean) =>
    renderToStaticMarkup(
      <DocumentList
        documents={documents as never}
        onSelect={() => undefined}
        problems={[]}
        selectedId={null}
        {...({ statusesLoading: loading } as object)}
      />,
    );
  expect(render(true).match(/확인 중/gu)).toHaveLength(1);
  expect(render(false)).not.toContain('확인 중');
});
