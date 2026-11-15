import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const webDir = fileURLToPath(new URL('.', import.meta.url));

async function sources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sources(path);
      return /\.(?:tsx?|css)$/u.test(entry.name) && !/\.test\./u.test(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
}

it('NOR-226 AC-1: 화면 코드와 스타일은 세리프를 쓰지 않는다', async () => {
  const offenders: string[] = [];
  for (const path of await sources(webDir)) {
    const text = await readFile(path, 'utf8');
    if (/font-serif|--font-serif/u.test(text)) offenders.push(path.slice(webDir.length));
  }
  expect(offenders).toEqual([]);
});

it('NOR-226 AC-2: 명조 웹폰트를 가져오지도, 의존성으로 두지도 않는다', async () => {
  const main = await readFile(new URL('./main.tsx', import.meta.url), 'utf8');
  const pkg = await readFile(new URL('../../package.json', import.meta.url), 'utf8');
  expect(main).not.toContain('noto-serif-kr');
  expect(pkg).not.toContain('noto-serif-kr');
});
