import { describe, expect, it } from 'vitest';
import { selectVisibleExperiences, type ExperienceLike } from './experience';

function experience(
  options: Pick<ExperienceLike, 'id'> & {
    readonly endDate: string | null;
    readonly visible: boolean;
  },
): ExperienceLike {
  return {
    id: options.id,
    data: {
      organization: `${options.id} 조직`,
      role: '개발자',
      period: '공개 기간',
      endDate: options.endDate === null ? null : new Date(`${options.endDate}T00:00:00.000Z`),
      highlights: ['공개 성과'],
      visible: options.visible,
    },
  };
}

describe('selectVisibleExperiences', () => {
  it('비공개 경력을 제외하고 종료일 역순으로 공개 경력을 정렬한다', () => {
    expect(
      selectVisibleExperiences([
        experience({ id: 'old', endDate: '2024-01-01', visible: true }),
        experience({ id: 'private', endDate: '2026-01-01', visible: false }),
        experience({ id: 'current', endDate: null, visible: true }),
      ]).map((item) => item.id),
    ).toEqual(['current', 'old']);
  });
});
