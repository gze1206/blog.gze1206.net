import { describe, expect, it } from 'vitest';

import { parseLedger, publishProgress, type PullInfo } from './progress.js';

describe('발행 진행 (NOR-228)', () => {
  it('NOR-228 AC-1: ledger 줄을 이름별 결과로 읽고, 모양이 다른 줄은 버리며 마지막 줄을 쓴다', () => {
    const ledger = parseLedger(
      [
        'a.json ok content/a-1',
        'b.json rejected bad-tree',
        'c.json stale base-not-in-main',
        'garbage line',
        'd.json ok not-content/x',
        'a.json ok content/a-2',
        '',
      ].join('\n'),
    );
    expect(ledger.get('a.json')).toEqual({ kind: 'ok', branch: 'content/a-2' });
    expect(ledger.get('b.json')).toEqual({ kind: 'rejected', reason: 'bad-tree' });
    expect(ledger.get('c.json')).toEqual({ kind: 'stale', reason: 'base-not-in-main' });
    expect(ledger.has('d.json')).toBe(false);
    expect(ledger.size).toBe(3);
  });

  it('NOR-228 AC-2: ledger 와 PR 조회 결과로 단계를 정한다', () => {
    const ok = { kind: 'ok', branch: 'content/a' } as const;
    const pull = (overrides: Partial<PullInfo>): PullInfo => ({
      number: 7,
      url: 'https://github.com/o/r/pull/7',
      state: 'open',
      merged: false,
      checks: 'pending',
      ...overrides,
    });
    expect(publishProgress('a.json', undefined, undefined).stage).toBe('queued');
    expect(publishProgress('a.json', { kind: 'rejected', reason: 'bad-tree' }, null)).toEqual({
      ref: 'a.json',
      stage: 'rejected',
      reason: 'bad-tree',
    });
    expect(publishProgress('a.json', { kind: 'stale', reason: 'x' }, null).stage).toBe('stale');
    expect(publishProgress('a.json', ok, null)).toEqual({
      ref: 'a.json',
      stage: 'relayed',
      branch: 'content/a',
    });
    expect(publishProgress('a.json', ok, pull({})).stage).toBe('checking');
    expect(publishProgress('a.json', ok, pull({ checks: 'failure' })).stage).toBe('failed');
    expect(publishProgress('a.json', ok, pull({ state: 'closed' })).stage).toBe('closed');
    expect(publishProgress('a.json', ok, pull({ state: 'closed', merged: true }))).toEqual({
      ref: 'a.json',
      stage: 'merged',
      branch: 'content/a',
      pull: { number: 7, url: 'https://github.com/o/r/pull/7' },
    });
  });
});
