export interface AcceptanceCriterion {
  readonly ticket: string;
  readonly id: string;
  readonly manual: boolean;
  readonly specPath: string;
}

const TICKET_IN_FILENAME = /(?:^|\/)(NOR-\d+)-[^/]*\.md$/u;
const CRITERION_LINE = /^\s*-\s+\*\*(AC-\d+)\*\*(\s*\(manual\))?/gmu;
const REFERENCE = /\b(NOR-\d+) (AC-\d+)\b/gu;

export function parseSpecCriteria(specPath: string, markdown: string): AcceptanceCriterion[] {
  const ticket = TICKET_IN_FILENAME.exec(specPath)?.[1];
  if (ticket === undefined) return [];
  return [...markdown.matchAll(CRITERION_LINE)].map((match) => ({
    ticket,
    id: match[1] ?? '',
    manual: match[2] !== undefined,
    specPath,
  }));
}

export function findCriterionReferences(source: string): Set<string> {
  return new Set([...source.matchAll(REFERENCE)].map((match) => `${match[1]} ${match[2]}`));
}

export function findUnlinkedCriteria(
  criteria: readonly AcceptanceCriterion[],
  references: ReadonlySet<string>,
): AcceptanceCriterion[] {
  return criteria.filter(
    (criterion) => !criterion.manual && !references.has(`${criterion.ticket} ${criterion.id}`),
  );
}
