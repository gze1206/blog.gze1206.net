import { readdir, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('NOR-215 AC-4: /books 는 책 JSON 의 구절 수만큼 구절을 보여 준다', async ({ page }) => {
  const dir = new URL('../src/content/books/', import.meta.url);
  let expected = 0;
  for (const name of (await readdir(dir)).filter((file) => file.endsWith('.json'))) {
    const book = JSON.parse(await readFile(new URL(name, dir), 'utf8')) as { quotes?: unknown[] };
    expected += book.quotes?.length ?? 0;
  }
  await page.goto('/books');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('.book-card__quote')).toHaveCount(expected);
});
