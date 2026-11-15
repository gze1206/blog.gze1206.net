import { expect, test } from '@playwright/test';

test('NOR-197 AC-11: 테마 전환은 새로고침 후에도 유지된다', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /모드로 전환/u });
  await expect(toggle).toBeVisible();
  const before = await page.locator('html').evaluate((root) => root.classList.contains('dark'));
  await toggle.click();
  await expect(page.locator('html')).toHaveClass(before ? /^(?!.*\bdark\b).*$/u : /\bdark\b/u);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(before ? /^(?!.*\bdark\b).*$/u : /\bdark\b/u);
});
