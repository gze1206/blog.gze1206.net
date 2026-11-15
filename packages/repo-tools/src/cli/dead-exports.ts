import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { findDeadExports, findDeadModules } from '../dead-exports/find.ts';

const files = new Map<string, string>();
async function walk(dir: string): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (
      ['node_modules', 'dist', '.astro', 'coverage', 'test-results', 'playwright-report'].includes(
        entry.name,
      )
    )
      continue;
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(?:ts|tsx|astro|mjs)$/.test(file)) files.set(file, await readFile(file, 'utf8'));
  }
}
await walk('apps/blog');
const input = { files, targetDir: 'apps/blog/src/lib' };
const dead = findDeadExports(input);
const modules = findDeadModules(input);
for (const file of modules) console.error(`${file}: unused module`);
for (const item of dead) console.error(`${item.file}: ${item.name}`);
console.log(`dead-exports: ${dead.length} unused exports, ${modules.length} unused modules`);
if (dead.length || modules.length) process.exitCode = 1;
