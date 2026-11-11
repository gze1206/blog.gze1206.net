import { describe, expect, it } from 'vitest';

import { bookCoverUrl } from './api.js';

describe('bookCoverUrl', () => {
  it('표지 파일 이름으로 주소를 만든다', () => {
    expect(bookCoverUrl('assets/books/9788901234567.jpg')).toBe(
      '/api/books/cover/9788901234567.jpg',
    );
  });

  it('한글 이름을 주소로 옮긴다', () => {
    expect(bookCoverUrl('assets/books/토지.jpg')).toBe(
      `/api/books/cover/${encodeURIComponent('토지.jpg')}`,
    );
  });

  /** 목록에 표지를 보이자고 작업 공간의 다른 파일까지 열어 줄 수는 없다. */
  it('표지 디렉터리 밖은 주소를 만들지 않는다', () => {
    expect(bookCoverUrl('books/9788901234567.md')).toBeNull();
    expect(bookCoverUrl('assets/books/../../.env')).toBeNull();
    expect(bookCoverUrl('assets/books/nested/a.jpg')).toBeNull();
    expect(bookCoverUrl('/etc/passwd')).toBeNull();
  });
});
