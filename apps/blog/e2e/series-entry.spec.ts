import { expect, test } from '@playwright/test';

test('NOR-207 AC-1: 탐색 페이지에서 시리즈로 갈 수 있다', async ({ page }) => {
  await page.goto('/topics');
  const section = page.getByRole('region', { name: '시리즈' });
  await expect(section).toBeVisible();
  const links = section.locator('a[href^="/series/"]');
  expect(await links.count()).toBeGreaterThan(0);
  await expect(links.first()).toContainText(/글 \d+개/u);
});

test('NOR-207 AC-2: 푸터에는 시리즈 링크가 없다', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toBeVisible();
  await expect(footer.locator('a[href="/series"]')).toHaveCount(0);
});
