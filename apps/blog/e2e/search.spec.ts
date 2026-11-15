import { expect, test } from '@playwright/test';

test('NOR-197 AC-11: 단축키로 검색 팔레트를 열어 공개 글을 찾는다', async ({ page }) => {
  await page.goto('/blog');
  const post = page.locator('main article h2 a').first();
  const title = (await post.innerText()).trim();
  const href = await post.getAttribute('href');
  const word = title.split(/\s+/u).find((part) => part.length >= 2);
  expect(word).toBeTruthy();
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: '블로그 검색' });
  const input = dialog.getByRole('combobox');
  await expect(input).toBeVisible();
  await input.fill(word ?? '');
  const result = dialog.getByRole('option').filter({ hasText: title });
  await expect(result).toBeVisible();
  const resultHref = await result.getAttribute('href');
  expect(resultHref?.replace(/\/$/u, '')).toBe(href);
});
