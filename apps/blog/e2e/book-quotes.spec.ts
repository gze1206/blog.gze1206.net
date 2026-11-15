import { readdir, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

interface BookJson {
  title: string;
  quotes?: { id: string; text: string; page?: number }[];
}

async function books(): Promise<{ id: string; book: BookJson }[]> {
  const dir = new URL('../src/content/books/', import.meta.url);
  const names = (await readdir(dir)).filter((file) => file.endsWith('.json'));
  return Promise.all(
    names.map(async (name) => ({
      id: name.slice(0, -5),
      book: JSON.parse(await readFile(new URL(name, dir), 'utf8')) as BookJson,
    })),
  );
}

test('NOR-216 AC-3: /books 카드는 상세 페이지로 링크하고 카드 안에서 구절을 펼치지 않는다', async ({
  page,
}) => {
  await page.goto('/books');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('.book-card__quotes')).toHaveCount(0);
  for (const { id } of await books()) {
    await expect(page.locator(`a[href="/books/${encodeURIComponent(id)}"]`).first()).toBeVisible();
  }
});

test('NOR-216 AC-2 · NOR-215 AC-4: 책 상세는 제목과 공개 구절을 모두 보여 준다', async ({
  page,
}) => {
  const list = await books();
  expect(list.length).toBeGreaterThan(0);
  for (const { id, book } of list) {
    const response = await page.goto(`/books/${encodeURIComponent(id)}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1')).toHaveText(book.title);
    await expect(page.locator('.book-quote')).toHaveCount(book.quotes?.length ?? 0);
    for (const quote of book.quotes ?? [])
      await expect(page.locator(`#q-${quote.id}`)).toBeVisible();
  }
});
