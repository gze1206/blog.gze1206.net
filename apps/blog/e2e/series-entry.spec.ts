import { expect, test } from '@playwright/test';

test('NOR-207 AC-1: 탐색의 시리즈 링크는 /series 목록과 같다', async ({ page }) => {
  await page.goto('/series');
  const listed = await page
    .locator('main a[href^="/series/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')).sort());
  await page.goto('/topics');
  const section = page.getByRole('region', { name: '시리즈' });
  if (listed.length === 0) {
    await expect(section).toHaveCount(0);
    return;
  }
  await expect(section).toBeVisible();
  const shown = await section
    .locator('a[href^="/series/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')).sort());
  expect(shown).toEqual(listed);
  await expect(section.locator('a').first()).toContainText(/글 \d+개/u);
});

test('NOR-207 AC-2: 푸터에는 시리즈 링크가 없다', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer).toBeVisible();
  await expect(footer.locator('a[href="/series"]')).toHaveCount(0);
});
