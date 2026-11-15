import { expect, test } from '@playwright/test';

test('NOR-197 AC-12: Markdown과 Markdoc 수식과 Mermaid를 렌더링한다', async ({ page }) => {
  await page.goto('/smoke/math-mermaid');
  const sections = page.locator('main section');
  await expect(sections).toHaveCount(2);
  for (const section of await sections.all()) {
    await expect(section.locator('.katex').first()).toBeVisible();
    await expect(section.locator('svg').first()).toBeVisible();
  }
});
