import { expect, it } from 'vitest';
import { sortPortfolio } from './portfolio';

it('NOR-197 AC-10: 포트폴리오를 안정적인 ID 순서로 정렬한다', () => {
  expect(sortPortfolio([{ id: 'b' }, { id: 'a' }]).map((entry) => entry.id)).toEqual(['a', 'b']);
});
