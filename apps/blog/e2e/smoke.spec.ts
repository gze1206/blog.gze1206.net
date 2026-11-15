import { expect, test } from '@playwright/test';

test('홈은 본문 랜드마크와 새 글 링크를 가진다', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main#main-content')).toBeVisible();
  await expect(page.locator('a[href^="/blog/"]').first()).toBeVisible();
});

test('글 목록에서 글 상세로 이동한다', async ({ page }) => {
  await page.goto('/blog');
  const first = page.locator('main a[href^="/blog/"]').first();
  const href = await first.getAttribute('href');
  await first.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`, 'u'));
  await expect(page.locator('main h1')).toBeVisible();
});

test('없는 주소는 404 페이지를 보여 준다', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
});
