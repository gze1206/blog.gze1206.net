import { describe, expect, it } from 'vitest';
import { derivePostDetail, type PostDetailInput } from './post-detail';

const BASE: PostDetailInput = {
  publishedAt: new Date('2026-07-20T00:00:00.000Z'),
  updatedAt: new Date('2026-07-20T00:00:00.000Z'),
  body: '짧은 본문입니다.',
  headings: [],
};

describe('derivePostDetail', () => {
  it('헤딩이 2개 이상이면 TOC 를 만든다', () => {
    const detail = derivePostDetail({
      ...BASE,
      headings: [
        { depth: 2, slug: 'a', text: 'A' },
        { depth: 3, slug: 'a-1', text: 'A-1' },
      ],
    });
    expect(detail.toc).toHaveLength(1);
    expect(detail.toc[0]?.children[0]?.id).toBe('a-1');
  });

  it('헤딩이 1개 이하면 TOC 를 만들지 않는다', () => {
    expect(derivePostDetail(BASE).toc).toEqual([]);
    expect(
      derivePostDetail({ ...BASE, headings: [{ depth: 2, slug: 'a', text: 'A' }] }).toc,
    ).toEqual([]);
  });

  it('읽기 시간은 항상 1분 이상으로 표기된다', () => {
    const detail = derivePostDetail({ ...BASE, body: '한 줄.' });
    expect(detail.readingTime.minutes).toBeGreaterThanOrEqual(1);
    expect(detail.readingTime.label).toBe('1분 미만');
  });

  it('본문이 없어도 터지지 않는다', () => {
    expect(derivePostDetail({ ...BASE, body: undefined }).readingTime.iso).toBe('PT1M');
  });

  it('발행일·수정일을 ISO 8601 로 내보낸다 (JSON-LD 대비)', () => {
    const detail = derivePostDetail({
      ...BASE,
      publishedAt: new Date('2026-07-20T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(detail.publishedISO).toBe('2026-07-20');
    expect(detail.updatedISO).toBe('2026-08-01');
    expect(detail.isUpdated).toBe(true);
  });

  it('수정일이 발행일과 같으면 isUpdated 가 false 다', () => {
    expect(derivePostDetail(BASE).isUpdated).toBe(false);
  });

  it('같은 입력은 항상 같은 출력이다 (결정적)', () => {
    expect(derivePostDetail(BASE)).toEqual(derivePostDetail(BASE));
  });
});
