import { describe, expect, it } from 'vitest';
import { extractImportSpecifiers, findBoundaryViolations } from './boundaries.ts';

const packages = [
  { name: '@gze1206/blog', dir: 'apps/blog' },
  { name: '@gze1206/workbench', dir: 'apps/workbench' },
  { name: '@gze1206/content-contract', dir: 'packages/content-contract' },
];

describe('extractImportSpecifiers', () => {
  it('NOR-195 AC-1: 정적·동적·부수효과·재수출 import 를 모두 찾는다', () => {
    const source = [
      "import a from './a.ts';",
      'import { b } from "../b";',
      "import './side.css';",
      "export { c } from '@gze1206/content-contract';",
      "const d = await import('./lazy.js');",
      "import type { E } from 'zod';",
    ].join('\n');
    expect(extractImportSpecifiers(source)).toEqual([
      './a.ts',
      '../b',
      './side.css',
      '@gze1206/content-contract',
      './lazy.js',
      'zod',
    ]);
  });
});

describe('findBoundaryViolations', () => {
  it('NOR-195 AC-1: 패키지 안의 상대 import 와 packages 이름 import 는 허용한다', () => {
    expect(
      findBoundaryViolations(
        [
          { file: 'apps/blog/src/lib/a.ts', specifier: '../content/schemas' },
          { file: 'apps/blog/src/lib/a.ts', specifier: '@gze1206/content-contract' },
          { file: 'apps/workbench/src/server/x.ts', specifier: 'zod' },
        ],
        packages,
      ),
    ).toEqual([]);
  });

  it('NOR-195 AC-1: 패키지 디렉터리를 벗어나는 상대 import 를 보고한다', () => {
    expect(
      findBoundaryViolations(
        [{ file: 'apps/blog/src/lib/a.ts', specifier: '../../../workbench/src/core/x.ts' }],
        packages,
      ),
    ).toEqual([
      {
        file: 'apps/blog/src/lib/a.ts',
        specifier: '../../../workbench/src/core/x.ts',
        reason: 'relative import leaves apps/blog',
      },
    ]);
  });

  it('NOR-195 AC-1: apps 패키지를 이름으로 import 하면 보고한다', () => {
    expect(
      findBoundaryViolations(
        [{ file: 'packages/content-contract/src/x.ts', specifier: '@gze1206/blog/src/y' }],
        packages,
      ),
    ).toEqual([
      {
        file: 'packages/content-contract/src/x.ts',
        specifier: '@gze1206/blog/src/y',
        reason: 'apps must not be imported: @gze1206/blog',
      },
    ]);
  });
});
