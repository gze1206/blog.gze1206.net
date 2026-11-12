import { describe, expect, it } from 'vitest';
import { ensureExcerptIds, updateExcerpt } from './excerpts.js';

describe('구절 식별', () => {
  it('NOR-196 AC-9: id 없는 구절에만 id 를 채운다', () => {
    const input = [{ text: 'one' }, { id: 'existing', text: 'two' }];
    expect(ensureExcerptIds(input, () => 'new')).toEqual([{ id: 'new', text: 'one' }, input[1]]);
    expect(input[0]).toEqual({ text: 'one' });
  });
  it('NOR-196 AC-9: 다른 구절을 지우거나 순서를 바꿔도 id 가 유지된다', () => {
    const input = [
      { id: 'a', text: 'one' },
      { id: 'b', text: 'two' },
    ] as const;
    expect(ensureExcerptIds([input[1], input[0]], () => 'new').map((x) => x.id)).toEqual([
      'b',
      'a',
    ]);
    expect(ensureExcerptIds([input[1]], () => 'new')[0]?.id).toBe('b');
  });
  it('NOR-196 AC-9: 구절을 고쳐도 id 와 public 이 남는다', () => {
    const input = [{ id: 'a', text: 'one', addedAt: '2026-01-01', public: true }];
    expect(updateExcerpt(input, 0, { text: 'changed' })).toEqual([
      { id: 'a', text: 'changed', addedAt: '2026-01-01', public: true },
    ]);
  });
});
