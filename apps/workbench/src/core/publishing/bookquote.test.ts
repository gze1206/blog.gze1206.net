import { describe, expect, it } from 'vitest';
import type { BookDocument } from '../document/document.js';
import { expandBookquotes, quoteWarnings } from './bookquote.js';

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const book: BookDocument = {
  kind: 'book',
  title: '책',
  authors: ['저자'],
  translators: ['번역자'],
  publisher: '출판사',
  publishedYear: 2020,
  status: 'reading',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  content: '',
  extra: {},
  excerpts: [{ id, text: '원문', page: 3, public: true }],
};
const tag = `{% bookquote book="책" excerpt="${id}" /%}`;
describe('구절 인용', () => {
  it('NOR-196 AC-11: 공개 구절을 원문과 출처로 펼친다', () => {
    const result = expandBookquotes(tag, () => book);
    expect(result.body).toContain(
      'title="책" authors=["저자"] translators=["번역자"] publisher="출판사" year=2020 page=3',
    );
    expect(result.body).toContain('원문');
    expect(result.quotes).toEqual([{ book: '책', excerpt: '원문', length: 2, bookPublicTotal: 2 }]);
  });
  it('NOR-196 AC-11: 없는 책·없는 구절·비공개 구절 인용을 거부한다', () => {
    expect(() => expandBookquotes(tag, () => undefined)).toThrow();
    expect(() => expandBookquotes(tag, () => ({ ...book, excerpts: [] }))).toThrow();
    expect(() =>
      expandBookquotes(tag, () => ({ ...book, excerpts: [{ id, text: '원문' }] })),
    ).toThrow();
  });
  it('NOR-196 AC-11: 저자가 없는 책의 인용을 거부한다', () => {
    expect(() => expandBookquotes(tag, () => ({ ...book, authors: [] }))).toThrow();
  });
  it('NOR-196 AC-11: 원본 형식 이외의 태그를 거부한다', () => {
    for (const source of [
      `{% bookquote book="책" excerpt="${id}" extra="x" /%}`,
      `{% bookquote book="책" excerpt="${id}" %}수동{% /bookquote %}`,
    ])
      expect(() => expandBookquotes(source, () => book)).toThrow();
  });
  it('NOR-196 AC-12: 500자 초과 인용과 책 누적 2000자 초과에 경고를 낸다', () => {
    expect(
      quoteWarnings([{ book: '책', excerpt: '가', length: 501, bookPublicTotal: 2001 }]),
    ).toHaveLength(2);
    expect(
      quoteWarnings([{ book: '책', excerpt: '가', length: 500, bookPublicTotal: 2000 }]),
    ).toHaveLength(0);
  });
});

it('NOR-196 AC-11: 제목이 빈 책의 인용을 거부한다', () => {
  expect(() => expandBookquotes(tag, () => ({ ...book, title: '' }))).toThrow();
});

it('NOR-196 AC-11: 저자 이름이 빈 책의 인용을 거부한다', () => {
  expect(() => expandBookquotes(tag, () => ({ ...book, authors: [''] }))).toThrow();
});
