import Markdoc, { type Node } from '@markdoc/markdoc';
import { expect, it } from 'vitest';
import { bookquoteTag, renderBookquote } from './index.ts';

const source = { book: '책', title: '제목', authors: ['저자'], translators: [] };
const config = { tags: { bookquote: bookquoteTag } };
it('NOR-196 AC-5: renderBookquote 결과는 bookquoteTag 로 Markdoc.validate 오류가 없다', () => {
  expect(Markdoc.validate(Markdoc.parse(renderBookquote(source, '인용')), config)).toEqual([]);
});
it('NOR-196 AC-5: 구절의 {% %} 와 Markdown 서식 문자가 그대로 글자로 남는다', () => {
  const text =
    '{% test %} *강조* _기울임_ `코드` [링크] <태그>\n\n# 제목\n\n> 인용\n\n- 목록\n\n1. 목록';
  const node = Markdoc.parse(renderBookquote(source, text)).children[0];
  function content(n: Node): string {
    return n.type === 'text'
      ? String(n.attributes.content)
      : n.children.map(content).join(n.type === 'tag' ? '\n\n' : '');
  }
  expect(node).toBeDefined();
  if (!node) throw new Error('missing bookquote');
  expect(content(node)).toBe(text);
});
it('NOR-196 AC-5: 선택 속성이 없으면 쓰지 않고, 속성 값의 따옴표를 이스케이프한다', () => {
  const result = renderBookquote({ ...source, title: 'a "b"' }, '인용');
  expect(result).not.toContain('publisher=');
  expect(result).toContain('title="a \\"b\\""');
  expect(Markdoc.validate(Markdoc.parse(result), config)).toEqual([]);
});

it('NOR-196 AC-5: NUL 문자가 있으면 거부한다', () => {
  expect(() => renderBookquote(source, 'a\0b')).toThrow();
  expect(() => renderBookquote({ ...source, title: 'a\0b' }, 'a')).toThrow();
});

it('NOR-196 AC-5: 목록·제목 밑줄·취소선·표 문법도 글자로 남는다', () => {
  const text =
    '+ 더하기 목록\n\n1) 괄호 목록\n\n밑줄 제목\n===\n\n~~취소~~\n\n| 칸 | 칸 |\n| --- | --- |';
  const node = Markdoc.parse(renderBookquote(source, text)).children[0];
  function content(n: Node): string {
    if (n.type === 'softbreak') return '\n';
    return n.type === 'text'
      ? String(n.attributes.content)
      : n.children.map(content).join(n.type === 'tag' ? '\n\n' : '');
  }
  if (!node) throw new Error('missing bookquote');
  expect(content(node)).toBe(text);
});

it('NOR-196 AC-5: 속성 순서는 입력 객체의 키 순서와 무관하다', () => {
  const shuffled = {
    page: 3,
    translators: ['역자'],
    authors: ['저자'],
    title: '제목',
    book: '책',
    year: 2020,
  };
  const ordered = {
    book: '책',
    title: '제목',
    authors: ['저자'],
    translators: ['역자'],
    year: 2020,
    page: 3,
  };
  expect(renderBookquote(shuffled, '인용')).toBe(renderBookquote(ordered, '인용'));
  expect(renderBookquote(ordered, '인용')).toMatch(
    /^\{% bookquote book=.* title=.* authors=.* translators=.* year=.* page=3 %\}/u,
  );
});

it('NOR-196 AC-5: 속성의 제어 문자와 본문의 줄바꿈·탭 외 제어 문자를 거부한다', () => {
  for (const character of ['\u0001', '\u007f', '\n', '\t'])
    expect(() => renderBookquote({ ...source, authors: [`a${character}b`] }, 'text')).toThrow();
  for (const character of ['\u0001', '\u007f', '\r'])
    expect(() => renderBookquote(source, `a${character}b`)).toThrow();
  expect(() => renderBookquote(source, 'a\nb\tc')).not.toThrow();
});
