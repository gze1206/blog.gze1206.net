import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SITE_COLLECTIONS, experienceSchema } from './index.ts';

const base = {
  organization: '회사',
  role: '개발',
  period: '2025.05 – 2025.09',
  endDate: '2025-09-01',
  highlights: ['일'],
  visible: true,
};

/** 실패한 경로들. 통과하면 빈 배열이다. */
function failedPaths(input: Record<string, unknown>): string[] {
  const result = experienceSchema.safeParse({ ...base, ...input });
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('경력 양식', () => {
  it('NOR-236 AC-1: 기간은 YYYY.MM – YYYY.MM 또는 YYYY.MM – 현재 이고 시작이 끝보다 늦지 않다', () => {
    expect(failedPaths({})).toEqual([]);
    expect(failedPaths({ period: '2025.05 – 현재', endDate: null })).toEqual([]);
    expect(failedPaths({ period: '2025.09 – 2025.09' })).toEqual([]);
    for (const period of [
      '2025.05 - 2025.09',
      '2025.5 – 2025.9',
      '2025.05–2025.09',
      '2025 – 2025.09',
      '2025.13 – 2025.09',
      '2025.00 – 2025.09',
      '2025.10 – 2025.09',
      '언젠가',
    ])
      expect(failedPaths({ period }), period).toContain('period');
  });

  it('NOR-236 AC-2: 끝난 날짜는 기간의 끝과 맞는다', () => {
    expect(failedPaths({ period: '2025.05 – 현재', endDate: '2025-09-01' })).toEqual(['endDate']);
    expect(failedPaths({ endDate: null })).toEqual(['endDate']);
    expect(failedPaths({ endDate: undefined })).toEqual(['endDate']);
    expect(failedPaths({ endDate: '2025-08-31' })).toEqual(['endDate']);
    expect(failedPaths({ endDate: '2025-09-30' })).toEqual([]);
  });
});

it('NOR-236 AC-5: 저장소의 모든 경력이 양식을 통과한다', () => {
  const dir = fileURLToPath(
    new URL(`../../../${SITE_COLLECTIONS.experience.path}/`, import.meta.url),
  );
  const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
  expect(files.length).toBeGreaterThan(0);
  const failures = files.flatMap((name) => {
    const result = experienceSchema.safeParse(JSON.parse(readFileSync(`${dir}${name}`, 'utf8')));
    return result.success ? [] : [`${name}: ${result.error.message}`];
  });
  expect(failures).toEqual([]);
});
