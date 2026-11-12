import { expect, test } from '@playwright/test';

for (const path of ['/series', '/tags', '/category']) {
  test(`NOR-197 AC-11: ${path} 목록에서 상세로 이동한다`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    const link = page.locator(`main a[href^="${path}/"]`).first();
    if ((await link.count()) === 0) {
      await expect(page.locator('main')).toContainText('아직');
      test.skip(true, '공개된 항목이 없어 상세 페이지를 확인할 수 없습니다.');
    }
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`, 'u'));
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main article').first()).toBeVisible();
  });
}
