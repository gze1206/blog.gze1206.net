import type { CollectionEntry } from 'astro:content';

export interface ExperienceLike {
  readonly id: string;
  readonly data: {
    readonly organization: string;
    readonly role: string;
    readonly period: string;
    readonly endDate: Date | null;
    readonly highlights: readonly string[];
    readonly visible: boolean;
  };
}

/** `visible: true`인 경력만 현재 재직 항목 우선, 종료일 내림차순으로 정렬한다. */
export function selectVisibleExperiences<T extends ExperienceLike>(experiences: readonly T[]): T[] {
  return experiences
    .filter((experience) => experience.data.visible)
    .sort((a, b) => {
      const aEndDate = a.data.endDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const bEndDate = b.data.endDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const diff = bEndDate - aEndDate;
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
}

/** 정적 사이트에 공개할 경력 목록. 비공개 항목은 이 경계에서 제거한다. */
export async function getVisibleExperiences(): Promise<CollectionEntry<'experience'>[]> {
  const { getCollection } = await import('astro:content');
  return selectVisibleExperiences(await getCollection('experience'));
}
