import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('NOR-230 AC-4: 책 상세는 구절에 메모가 있으면 구절 아래에 보인다', async () => {
  const page = await readFile(new URL('../pages/books/[id].astro', import.meta.url), 'utf8');
  expect(page).toMatch(/quote\.memo\s*!==\s*undefined/u);
  expect(page).toContain('book-quote__memo');
  const css = await readFile(new URL('../styles/global.css', import.meta.url), 'utf8');
  expect(css).toContain('.book-quote__memo');
});
