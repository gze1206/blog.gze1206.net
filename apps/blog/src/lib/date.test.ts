import { describe, expect, it } from 'vitest';
import { formatKoreanDate, toISODate } from './date';

describe('toISODate', () => {
  it('UTC 기준 YYYY-MM-DD 를 만든다', () => {
    expect(toISODate(new Date('2026-07-20'))).toBe('2026-07-20');
    expect(toISODate(new Date('2026-01-05T23:59:59Z'))).toBe('2026-01-05');
  });
});

describe('formatKoreanDate', () => {
  it('한국어 날짜로 포매팅한다', () => {
    expect(formatKoreanDate(new Date('2026-07-20'))).toBe('2026년 7월 20일');
  });

  it('UTC 자정을 로컬 타임존으로 밀지 않는다', () => {
    // 프론트매터 `2026-01-01` 은 UTC 자정으로 파싱된다. 로컬 기준으로 포매팅하면
    // UTC 뒤쪽 타임존에서 2025년 12월 31일이 되어버린다.
    expect(formatKoreanDate(new Date('2026-01-01'))).toBe('2026년 1월 1일');
    expect(toISODate(new Date('2026-01-01'))).toBe('2026-01-01');
  });
});
