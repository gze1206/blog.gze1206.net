import { describe, expect, it } from 'vitest';

import { bookSlug, normalizeIsbn, parseGoogleBooks, parseOpenLibrary } from './metadata.js';

describe('normalizeIsbn', () => {
  it('하이픈과 공백을 걷어낸 13자리만 받는다', () => {
    expect(normalizeIsbn('978-89-0123-456-7')).toBe('9788901234567');
    expect(normalizeIsbn(' 9788901234567 ')).toBe('9788901234567');
    expect(normalizeIsbn('8901234567')).toBeNull();
    expect(normalizeIsbn('97889012345678')).toBeNull();
    expect(normalizeIsbn('978890123456X')).toBeNull();
  });
});

describe('parseOpenLibrary', () => {
  const isbn = '9788901234567';

  it('제목·저자·출판사·연도·표지를 옮긴다', () => {
    const payload = {
      [`ISBN:${isbn}`]: {
        title: '니체의 초월자',
        authors: [{ name: '프리드리히 니체' }],
        publishers: [{ name: '어떤출판사' }],
        publish_date: 'March 2020',
        cover: { medium: 'https://covers.example/m.jpg', large: 'https://covers.example/l.jpg' },
      },
    };

    expect(parseOpenLibrary(payload, isbn)).toEqual({
      title: '니체의 초월자',
      authors: ['프리드리히 니체'],
      publisher: '어떤출판사',
      publishedYear: 2020,
      isbn13: isbn,
      // 큰 표지가 있으면 그것을 쓴다. 한 번 받아 저장하므로 화질을 아낄 이유가 없다.
      coverUrl: 'https://covers.example/l.jpg',
      source: 'Open Library',
    });
  });

  it('없는 항목은 키 자체를 두지 않는다', () => {
    const result = parseOpenLibrary({ [`ISBN:${isbn}`]: { title: '제목만' } }, isbn);

    expect(result).toEqual({ title: '제목만', authors: [], isbn13: isbn, source: 'Open Library' });
    expect(result && 'publisher' in result).toBe(false);
  });

  it('찾지 못하면 null 이다', () => {
    expect(parseOpenLibrary({}, isbn)).toBeNull();
    expect(parseOpenLibrary({ [`ISBN:${isbn}`]: {} }, isbn)).toBeNull();
    expect(parseOpenLibrary(null, isbn)).toBeNull();
  });
});

describe('parseGoogleBooks', () => {
  const isbn = '9788901234567';

  it('부제를 제목에 합치고 http 표지를 https 로 바꾼다', () => {
    const payload = {
      items: [
        {
          volumeInfo: {
            title: '제목',
            subtitle: '부제',
            authors: ['저자 A', '저자 B'],
            publisher: '출판사',
            publishedDate: '2019-05-01',
            imageLinks: { thumbnail: 'http://books.example/t.jpg' },
          },
        },
      ],
    };

    expect(parseGoogleBooks(payload, isbn)).toEqual({
      title: '제목: 부제',
      authors: ['저자 A', '저자 B'],
      publisher: '출판사',
      publishedYear: 2019,
      isbn13: isbn,
      coverUrl: 'https://books.example/t.jpg',
      source: 'Google Books',
    });
  });

  it('결과가 없으면 null 이다', () => {
    expect(parseGoogleBooks({ items: [] }, isbn)).toBeNull();
    expect(parseGoogleBooks({ totalItems: 0 }, isbn)).toBeNull();
  });
});

describe('bookSlug', () => {
  it('한글 제목을 그대로 살리고 공백만 잇는다', () => {
    expect(bookSlug('니체의 초월자')).toBe('니체의-초월자');
  });

  it('경로를 망가뜨리는 글자를 걷어낸다', () => {
    expect(bookSlug('a/b\\c:d?e')).toBe('abcde');
    expect(bookSlug('../../etc/passwd')).toBe('etcpasswd');
  });

  it('남는 것이 없으면 이름을 지어 준다', () => {
    expect(bookSlug('///')).toBe('untitled');
  });
});
