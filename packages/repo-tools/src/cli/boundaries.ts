// 저장소 루트에서 실행한다: node packages/repo-tools/src/cli/boundaries.ts
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  extractImportSpecifiers,
  findBoundaryViolations,
  type ImportSite,
  type WorkspacePackage,
} from '../boundaries.ts';

const SOURCE_FILE = /\.(?:ts|tsx|mts|mjs|js|astro)$/u;
const SKIP_DIR = new Set(['node_modules', 'dist', '.astro', 'test-results', 'playwright-report']);

async function listPackages(root: string): Promise<WorkspacePackage[]> {
  const result: WorkspacePackage[] = [];
  for (const group of ['apps', 'packages']) {
    for (const entry of await readdir(path.join(root, group), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = `${group}/${entry.name}`;
      const manifest = JSON.parse(await readFile(path.join(root, dir, 'package.json'), 'utf8')) as {
        name: string;
      };
      result.push({ name: manifest.name, dir });
    }
  }
  return result;
}

async function* walk(root: string, dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if (SKIP_DIR.has(entry.name)) continue;
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) yield* walk(root, child);
    else if (SOURCE_FILE.test(entry.name)) yield child;
  }
}

const root = process.cwd();
const packages = await listPackages(root);
const sites: ImportSite[] = [];
for (const pkg of packages) {
  for await (const file of walk(root, pkg.dir)) {
    const source = await readFile(path.join(root, file), 'utf8');
    for (const specifier of extractImportSpecifiers(source)) sites.push({ file, specifier });
  }
}
const violations = findBoundaryViolations(sites, packages);
for (const v of violations) console.error(`✗ ${v.file}: '${v.specifier}' — ${v.reason}`);
console.log(`boundaries: ${sites.length} imports, ${violations.length} violations`);
process.exit(violations.length === 0 ? 0 : 1);
