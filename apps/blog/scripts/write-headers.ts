// 빌드 뒤 dist/_headers 에 CSP 를 쓴다 (NOR-201). 산출물 HTML 의 인라인 스크립트 해시를 모두 모은다.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildCsp, CSP_MODE, inlineScriptHashes, renderHeaders } from '../src/lib/csp.ts';

const files = (await readdir('dist', { recursive: true })).filter((name) => name.endsWith('.html'));
const hashes: string[] = [];
for (const name of files)
  hashes.push(...inlineScriptHashes(await readFile(join('dist', name), 'utf8')));
await writeFile('dist/_headers', renderHeaders(buildCsp(hashes), CSP_MODE));
console.log(
  `_headers: ${CSP_MODE}, ${new Set(hashes).size} inline script hashes from ${files.length} pages`,
);
