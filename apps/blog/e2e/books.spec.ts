import { expect, test } from '@playwright/test';

test('NOR-196 AC-8: 책장 항목은 책 id 앵커를 가진다', async ({ page }) => {
  await page.goto('/books');
  await expect(page.locator('li.book-card#니체의-초월자')).toHaveCount(1);
});
