import { describe, expect, it } from 'vitest';
import { findCriterionReferences, findUnlinkedCriteria, parseSpecCriteria } from './spec-check.ts';

const spec = [
  '# NOR-12 — 예시',
  '',
  '- **AC-1** 첫 번째 기준',
  '- **AC-2** (manual) 눈으로 확인한다',
  '  - **AC-3** 들여쓴 기준',
  '본문에 AC-9 라고만 쓴 것은 기준이 아니다',
].join('\n');

describe('parseSpecCriteria', () => {
  it('NOR-195 AC-2: 파일명의 일감 번호와 목록의 AC 를 읽고 manual 을 구분한다', () => {
    expect(parseSpecCriteria('docs/spec/repo/NOR-12-example.md', spec)).toEqual([
      { ticket: 'NOR-12', id: 'AC-1', manual: false, specPath: 'docs/spec/repo/NOR-12-example.md' },
      { ticket: 'NOR-12', id: 'AC-2', manual: true, specPath: 'docs/spec/repo/NOR-12-example.md' },
      { ticket: 'NOR-12', id: 'AC-3', manual: false, specPath: 'docs/spec/repo/NOR-12-example.md' },
    ]);
  });

  it('NOR-195 AC-2: 일감 번호가 없는 파일은 비어 있다', () => {
    expect(parseSpecCriteria('docs/spec/README.md', spec)).toEqual([]);
  });
});

describe('findUnlinkedCriteria', () => {
  it('NOR-195 AC-2: 테스트 이름에 연결되지 않은 자동 기준만 보고한다', () => {
    const criteria = parseSpecCriteria('docs/spec/repo/NOR-12-example.md', spec);
    const references = findCriterionReferences(
      "it('NOR-12 AC-1: 첫 번째', () => {});\nit('NOR-13 AC-3: 다른 일감', () => {});",
    );
    expect(findUnlinkedCriteria(criteria, references).map((c) => c.id)).toEqual(['AC-3']);
  });
});
