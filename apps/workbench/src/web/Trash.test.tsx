import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('휴지통 화면', () => {
  it('NOR-205 AC-5: 휴지통 항목마다 복원과 영구 삭제를 보여 준다', async () => {
    const mod = await import('./TrashList.js');
    expect(mod).toHaveProperty('TrashList');
    const html = renderToStaticMarkup(
      <mod.TrashList
        items={[
          {
            id: 't1',
            relativePath: 'drafts/a.md',
            title: '지운 글',
            deletedAt: '2026-11-15T01:00:00.000Z',
          },
        ]}
        onChanged={() => undefined}
        onError={() => undefined}
      />,
    );
    expect(html).toContain('휴지통');
    expect(html).toContain('지운 글');
    expect(html).toContain('복원');
    expect(html).toContain('영구 삭제');
  });
});
