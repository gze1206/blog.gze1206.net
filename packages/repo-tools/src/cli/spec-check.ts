// 저장소 루트에서 실행한다: node packages/repo-tools/src/cli/spec-check.ts
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  findCriterionReferences,
  findUnlinkedCriteria,
  parseSpecCriteria,
  type AcceptanceCriterion,
} from '../spec-check.ts';

const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|mts)$/u;
const SKIP = /(?:^|\/)(?:node_modules|dist|\.astro)(?:\/|$)/u;

async function files(root: string, dir: string, pattern: RegExp): Promise<string[]> {
  const entries = await readdir(path.join(root, dir), { recursive: true });
  return entries
    .map((entry) => `${dir}/${entry.split(path.sep).join('/')}`)
    .filter((file) => !SKIP.test(file) && pattern.test(file));
}

const root = process.cwd();
const criteria: AcceptanceCriterion[] = [];
for (const spec of await files(root, 'docs/spec', /\.md$/u)) {
  criteria.push(...parseSpecCriteria(spec, await readFile(path.join(root, spec), 'utf8')));
}
const references = new Set<string>();
for (const group of ['apps', 'packages']) {
  for (const test of await files(root, group, TEST_FILE)) {
    for (const ref of findCriterionReferences(await readFile(path.join(root, test), 'utf8'))) {
      references.add(ref);
    }
  }
}
const unlinked = findUnlinkedCriteria(criteria, references);
for (const c of unlinked)
  console.error(`✗ ${c.ticket} ${c.id} (${c.specPath}) 를 참조하는 테스트가 없다`);
console.log(`spec:check: ${criteria.length} criteria, ${unlinked.length} unlinked`);
process.exit(unlinked.length === 0 ? 0 : 1);
