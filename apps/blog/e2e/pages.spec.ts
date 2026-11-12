import { expect, test } from '@playwright/test';

for (const path of ['/topics', '/about', '/portfolio']) {
  test(`NOR-197 AC-11: ${path} 본문을 표시한다`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main#main-content h1')).toBeVisible();
  });
}

test('NOR-197 AC-11: 두 번째 글 목록 또는 404를 표시한다', async ({ page }) => {
  await page.goto('/blog');
  const secondPage = page.locator('main a[href="/blog/2"]');
  const hasSecondPage = (await secondPage.count()) > 0;
  const response = await page.goto('/blog/2');
  expect(response?.status()).toBe(hasSecondPage ? 200 : 404);
  if (hasSecondPage) await expect(page.locator('main article').first()).toBeVisible();
});

test('NOR-197 AC-11: 404는 안내와 홈 링크를 표시한다', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(page.locator('main h1')).toContainText('찾을 수 없습니다');
  await expect(page.locator('a[href="/"]').first()).toBeVisible();
});
