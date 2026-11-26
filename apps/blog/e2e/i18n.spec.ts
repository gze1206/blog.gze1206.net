import { expect, test } from '@playwright/test';

test('NOR-250 AC-6: 영어 첫 화면·목록·피드가 있고 페이지 언어와 메뉴가 영어다', async ({
  page,
  request,
}) => {
  for (const path of ['/en', '/en/blog']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Blog' })).toBeVisible();
    await expect(page.getByRole('link', { name: '한국어' })).toBeVisible();
  }
  const feed = await request.get('/en/rss.xml');
  expect(feed.status()).toBe(200);
  expect(await feed.text()).toContain('<language>en-US</language>');
});

test('NOR-250 AC-6: 한국어 페이지는 한국어로 남고 영어 첫 화면으로 가는 링크가 있다', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en$/u);
});
