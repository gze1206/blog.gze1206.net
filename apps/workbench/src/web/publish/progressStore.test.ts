import { describe, expect, it } from 'vitest';

import { addJob, applyProgress, isFinal, loadJobs, removeJob, saveJobs } from './progressStore.js';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  };
}

const job = (ref: string) => ({
  ref,
  title: `${ref} 글`,
  startedAt: '2026-11-15T00:00:00.000Z',
  stage: 'queued' as const,
});

describe('발행 진행 토스트 저장소 (NOR-228)', () => {
  it('NOR-228 AC-5: 발행을 더하고 단계를 갱신하고 끝난 발행을 구분한다', () => {
    let jobs = addJob([], job('a.json'));
    jobs = addJob(jobs, job('b.json'));
    jobs = addJob(jobs, job('a.json'));
    expect(jobs.map((item) => item.ref)).toEqual(['a.json', 'b.json']);
    jobs = applyProgress(jobs, [
      {
        ref: 'a.json',
        stage: 'merged',
        branch: 'content/a',
        pull: { number: 3, url: 'https://github.com/o/r/pull/3' },
      },
      { ref: 'b.json', stage: 'rejected', reason: 'bad-tree' },
    ]);
    expect(jobs[0]).toMatchObject({ stage: 'merged', pull: { number: 3 } });
    expect(jobs[1]).toMatchObject({ stage: 'rejected', reason: 'bad-tree' });
    expect(isFinal('merged') && isFinal('rejected') && isFinal('failed')).toBe(true);
    expect(isFinal('checking') || isFinal('queued') || isFinal('relayed')).toBe(false);
    expect(removeJob(jobs, 'a.json').map((item) => item.ref)).toEqual(['b.json']);
  });

  it('NOR-228 AC-5: localStorage 로 다시 읽고 깨진 값은 버린다', () => {
    const storage = memoryStorage();
    saveJobs(storage, [job('a.json')]);
    expect(loadJobs(storage)).toEqual([job('a.json')]);
    storage.setItem('workbench.publishJobs', '{"not":"array"}');
    expect(loadJobs(storage)).toEqual([]);
    storage.setItem(
      'workbench.publishJobs',
      JSON.stringify([job('a.json'), { ref: '../x', title: 1 }, 'x']),
    );
    expect(loadJobs(storage)).toEqual([job('a.json')]);
    storage.setItem('workbench.publishJobs', 'not json');
    expect(loadJobs(storage)).toEqual([]);
  });
});
