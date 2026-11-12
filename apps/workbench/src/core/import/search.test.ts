import { describe, expect, it } from 'vitest';

import { matchImportablePosts } from './search.js';

const posts = [
  { title: '클린 아키텍처 정리', slug: 'clean-architecture' },
  { title: 'C# 9.0 record 타입', slug: 'c-9-0-record-type' },
  { title: '2025년 회고', slug: 'retrospective-2025' },
];

describe('matchImportablePosts', () => {
  it('검색어가 없으면 다 보여 준다', () => {
    expect(matchImportablePosts(posts, '')).toHaveLength(3);
    expect(matchImportablePosts(posts, '   ')).toHaveLength(3);
  });

  it('제목의 일부로 찾는다', () => {
    expect(matchImportablePosts(posts, '회고').map((post) => post.slug)).toEqual([
      'retrospective-2025',
    ]);
  });

  it('slug 로도 찾는다', () => {
    expect(matchImportablePosts(posts, 'record').map((post) => post.slug)).toEqual([
      'c-9-0-record-type',
    ]);
  });

  it('띄어쓰기를 신경 쓰지 않는다', () => {
    expect(matchImportablePosts(posts, '클린아키텍처')).toHaveLength(1);
    expect(matchImportablePosts(posts, '클 린 아키텍처')).toHaveLength(1);
  });

  it('대소문자를 가리지 않는다', () => {
    expect(matchImportablePosts(posts, 'RECORD')).toHaveLength(1);
  });

  it('없는 것은 없다고 한다', () => {
    expect(matchImportablePosts(posts, '없는글')).toEqual([]);
  });
});
