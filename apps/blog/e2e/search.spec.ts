import { expect, test } from '@playwright/test';

test('NOR-197 AC-11: 단축키로 검색 팔레트를 열어 공개 글을 찾는다', async ({ page }) => {
  await page.goto('/blog');
  const post = page.locator('main article h2 a').first();
  const title = (await post.innerText()).trim();
  const href = await post.getAttribute('href');
  const word = title.split(/\s+/u).find((part) => part.length >= 2);
  expect(word).toBeTruthy();
  // 단축키는 island 가 hydration 된 뒤에야 듣는다. 부하가 있으면 그 전에 누를 수 있다.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
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

test('NOR-231 AC-3: 첫 화면은 React 를 받지 않고, 검색을 열 때 받는다', async ({ page }) => {
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('astro-island')).toHaveCount(0);
  expect(scripts.some((url) => /\/(react|client)\.[\w-]+\.js$/u.test(url))).toBe(false);

  await page.getByRole('link', { name: /^검색/u }).click();
  // cmdk 의 dialog 요소는 자식이 fixed 라 크기가 0 이다. 보이는지는 입력 칸으로 본다.
  await expect(
    page.getByRole('dialog', { name: '블로그 검색' }).getByRole('combobox'),
  ).toBeVisible();
  expect(scripts.some((url) => /\/SearchPalette\.[\w-]+\.js$/u.test(url))).toBe(true);
});

test('NOR-231 AC-4: 팔레트를 닫으면 검색 링크로 포커스가 돌아오고, 단축키로 다시 열린다', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByRole('dialog', { name: '블로그 검색' }).getByRole('combobox');
  await expect(input).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(input).toBeHidden();
  await expect(page.getByRole('link', { name: /^검색/u })).toBeFocused();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(input).toBeVisible();
});
