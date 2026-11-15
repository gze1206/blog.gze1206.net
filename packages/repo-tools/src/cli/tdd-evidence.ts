// 저장소 루트에서 실행한다: node packages/repo-tools/src/cli/tdd-evidence.ts --base origin/v4
import { parseArgs } from 'node:util';
import { runTddEvidence } from '../tdd/run.ts';

const { values } = parseArgs({
  options: { base: { type: 'string' }, head: { type: 'string', default: 'HEAD' } },
});
if (values.base === undefined) {
  console.error('--base 가 필요하다');
  process.exit(2);
}
const result = await runTddEvidence({
  repoRoot: process.cwd(),
  base: values.base,
  head: values.head,
});
for (const line of result.lines) console.log(line);
process.exit(result.ok ? 0 : 1);
