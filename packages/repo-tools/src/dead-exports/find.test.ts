import { expect, it } from 'vitest';
import { findDeadExports, findDeadModules } from './find.ts';

it('NOR-197 AC-9: Astro, 별칭, namespace와 테스트 import를 해석한다', () => {
  const files = new Map([
    [
      'apps/blog/src/lib/a.ts',
      'export const used = 1; export const testOnly = 2; export const dead = 3; export type Model = string;',
    ],
    ['apps/blog/src/lib/b.ts', 'export const one = 1; export const two = 2;'],
    ['apps/blog/src/lib/orphan.ts', 'export const orphan = 1;'],
    ['apps/blog/src/lib/orphan.test.ts', "import { orphan } from './orphan';"],
    [
      'apps/blog/src/pages/a.astro',
      "---\nimport { used } from '@/lib/a';\nimport type { Model } from '../lib/a';\n---",
    ],
    ['apps/blog/src/pages/b.ts', "import * as b from '../lib/b'; console.log(b);"],
    ['apps/blog/src/lib/a.test.ts', "import { testOnly } from './a';"],
  ]);
  const input = { files, targetDir: 'apps/blog/src/lib' };
  expect(findDeadExports(input)).toEqual([{ file: 'apps/blog/src/lib/a.ts', name: 'dead' }]);
  expect(findDeadModules(input)).toEqual(['apps/blog/src/lib/orphan.ts']);
});

it('NOR-231 AC-3: Astro 의 <script> 안 import 도 사용으로 센다', () => {
  const files = new Map([
    ['apps/blog/src/lib/lazy.ts', 'export const lazy = 1; export const dead = 2;'],
    [
      'apps/blog/src/components/C.astro',
      "---\nconst a = 1;\n---\n<button />\n<script>\n  import { lazy } from '../lib/lazy';\n  console.log(lazy);\n</script>",
    ],
  ]);
  const input = { files, targetDir: 'apps/blog/src/lib' };
  expect(findDeadModules(input)).toEqual([]);
  expect(findDeadExports(input)).toEqual([{ file: 'apps/blog/src/lib/lazy.ts', name: 'dead' }]);
});
