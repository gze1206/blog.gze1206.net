import Markdoc from '@markdoc/markdoc';
import { expect, it } from 'vitest';
import * as contract from './index.ts';

function render(source: string): string {
  const item = (contract as Record<string, unknown>)['taskItemNode'];
  expect(item).toBeDefined();
  const config = { nodes: { item: item as never } };
  return Markdoc.renderers.html(Markdoc.transform(Markdoc.parse(source), config));
}

it('NOR-239 AC-4: 작업 항목은 누를 수 없는 체크박스로, 다른 항목은 그대로 렌더한다', () => {
  const html = render('- [ ] 할 일\n- [x] 끝낸 일\n- [X] 대문자\n- 그냥 항목\n- [ ]붙은 글자\n');
  const items = html.match(/<li[^>]*>.*?<\/li>/gu) ?? [];
  expect(items).toHaveLength(5);
  expect(items[0]).toMatch(/^<li class="task-list-item"><input[^>]*type="checkbox"/u);
  expect(items[0]).toContain('disabled');
  expect(items[0]).not.toContain('checked');
  expect(items[0]).toContain('할 일');
  expect(items[0]).not.toContain('[ ]');
  expect(items[1]).toContain('checked');
  expect(items[2]).toContain('checked');
  expect(items[3]).toBe('<li>그냥 항목</li>');
  expect(items[4]).not.toContain('checkbox');
});

it('NOR-239 AC-4: 느슨한 목록의 작업 항목도 체크박스로 렌더한다', () => {
  const html = render('- [x] 첫째\n\n- [ ] 둘째\n');
  expect(html.match(/type="checkbox"/gu)).toHaveLength(2);
  expect(html).not.toContain('[x]');
});
