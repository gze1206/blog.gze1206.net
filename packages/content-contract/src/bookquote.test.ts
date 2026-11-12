import Markdoc from '@markdoc/markdoc';
import { expect, it } from 'vitest';
import { bookquoteTag, renderBookquote } from './index.js';

const source = { book: '책', title: '제목', authors: ['저자'], translators: [] };
const config = { tags: { bookquote: bookquoteTag } };
it('NOR-196 AC-5: renderBookquote 결과는 bookquoteTag 로 Markdoc.validate 오류가 없다', () => {
  expect(Markdoc.validate(Markdoc.parse(renderBookquote(source, '인용')), config)).toEqual([]);
});
it('NOR-196 AC-5: 구절의 {% %} 와 Markdown 서식 문자가 그대로 글자로 남는다', () => {
  const text =
    '{% test %} *강조* _기울임_ `코드` [링크] <태그>\n\n# 제목\n\n> 인용\n\n- 목록\n\n1. 목록';
  const node = Markdoc.parse(renderBookquote(source, text)).children[0]!;
  function content(n: typeof node): string {
    return n.type === 'text'
      ? String(n.attributes.content)
      : n.children.map(content).join(n.type === 'tag' ? '\n\n' : '');
  }
  expect(content(node)).toBe(text);
});
it('NOR-196 AC-5: 선택 속성이 없으면 쓰지 않고, 속성 값의 따옴표를 이스케이프한다', () => {
  const result = renderBookquote({ ...source, title: 'a "b"' }, '인용');
  expect(result).not.toContain('publisher=');
  expect(result).toContain('title="a \\"b\\""');
  expect(Markdoc.validate(Markdoc.parse(result), config)).toEqual([]);
});
