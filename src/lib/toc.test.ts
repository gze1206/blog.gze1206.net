import { describe, expect, it } from 'vitest';
import { buildToc, type HeadingRef } from './toc';

function h(depth: number, text: string, slug = text): HeadingRef {
  return { depth, slug, text };
}

describe('buildToc', () => {
  it('h2 를 최상위로 늘어놓는다', () => {
    const toc = buildToc([h(2, '설치하기'), h(2, '사용하기')]);
    expect(toc).toEqual([
      { id: '설치하기', text: '설치하기', children: [] },
      { id: '사용하기', text: '사용하기', children: [] },
    ]);
  });

  it('h3 를 바로 앞 h2 아래로 중첩한다', () => {
    const toc = buildToc([h(2, 'A'), h(3, 'A-1'), h(3, 'A-2'), h(2, 'B'), h(3, 'B-1')]);
    expect(toc.map((entry) => entry.id)).toEqual(['A', 'B']);
    expect(toc[0]?.children.map((entry) => entry.id)).toEqual(['A-1', 'A-2']);
    expect(toc[1]?.children.map((entry) => entry.id)).toEqual(['B-1']);
  });

  it('h1 과 h4 이하는 담지 않는다', () => {
    const toc = buildToc([h(1, '글 제목'), h(2, '본문'), h(4, '너무 깊음'), h(2, '마무리')]);
    expect(toc.map((entry) => entry.id)).toEqual(['본문', '마무리']);
    expect(toc.flatMap((entry) => entry.children)).toEqual([]);
  });

  it('부모 h2 가 없는 h3 는 버리지 않고 최상위로 올린다', () => {
    const toc = buildToc([h(3, '먼저 나온 h3'), h(3, '두 번째 h3'), h(2, '뒤늦은 h2')]);
    expect(toc.map((entry) => entry.id)).toEqual(['먼저 나온 h3', '두 번째 h3', '뒤늦은 h2']);
    // 앞선 h3 끼리 서로 중첩되면 안 된다.
    expect(toc[0]?.children).toEqual([]);
  });

  it('헤딩이 1개 이하면 빈 배열을 준다 (TOC 를 렌더하지 않는다)', () => {
    expect(buildToc([])).toEqual([]);
    expect(buildToc([h(2, '하나뿐')])).toEqual([]);
    // 담을 수 있는 헤딩이 1개뿐인 경우도 마찬가지다.
    expect(buildToc([h(1, '제목'), h(2, '하나뿐'), h(4, '제외됨')])).toEqual([]);
  });

  it('id 가 없거나 텍스트가 빈 헤딩은 담지 않는다', () => {
    const toc = buildToc([h(2, 'A'), { depth: 2, slug: '', text: 'id 없음' }, h(2, 'B')]);
    expect(toc.map((entry) => entry.id)).toEqual(['A', 'B']);
    expect(buildToc([h(2, 'A'), { depth: 2, slug: 'blank', text: '   ' }])).toEqual([]);
  });

  it('헤딩 텍스트의 앞뒤 공백을 다듬는다', () => {
    const toc = buildToc([{ depth: 2, slug: 'a', text: '  설치하기\n' }, h(2, 'B')]);
    expect(toc[0]?.text).toBe('설치하기');
  });

  it('TOC 링크는 항상 렌더러가 붙인 헤딩 id 를 가리킨다', () => {
    const headings = [h(2, '설치', 'install'), h(3, '요구 사항', 'requirements')];
    const toc = buildToc(headings);
    const ids = [toc[0]?.id, toc[0]?.children[0]?.id];
    expect(ids).toEqual(headings.map((heading) => heading.slug));
  });
});
