import { expect, test } from '@playwright/test';

const EMPTY_MESSAGES: Record<string, string> = {
  '/series': '아직 발행된 시리즈가 없습니다.',
  '/tags': '아직 태그가 없습니다.',
  '/category': '아직 카테고리가 없습니다.',
};

for (const path of ['/series', '/tags', '/category']) {
  test(`NOR-197 AC-11: ${path} 목록에서 상세로 이동하거나, 항목이 없으면 빈 상태를 보여 준다`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    const link = page.locator(`main a[href^="${path}/"]`).first();
    if ((await link.count()) === 0) {
      // 공개 글에 항목이 없으면 상세 페이지가 만들어지지 않는다. 빈 상태 안내가 그 대신이다.
      await expect(page.locator('main')).toContainText(EMPTY_MESSAGES[path] ?? '아직');
      return;
    }
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`, 'u'));
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('main article').first()).toBeVisible();
  });
}
