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
    await expect(
      page.getByRole('banner').getByRole('link', { name: '한국어', exact: true }),
    ).toBeVisible();
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
  await page.getByRole('banner').getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en$/u);
  // 글 머리의 한국어 문구는 그대로이고, 문구와 값 사이 공백도 남아 있다.
  await page.goto('/blog/c-9-0-record-type');
  await expect(page.locator('.article__meta')).toContainText(/읽는 시간 (약 \d+분|1분 미만)/u);
});

for (const [ko, en, heading] of [
  ['/about', '/en/about', 'Experience'],
  ['/portfolio', '/en/portfolio', 'Portfolio'],
] as const) {
  test(`NOR-251 AC-4: ${en} 는 영어로 그려지고 ${ko} 와 hreflang 으로 이어진다`, async ({
    page,
  }) => {
    const response = await page.goto(en);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByText(heading, { exact: true }).first()).toBeVisible();
    // 깨진 이미지가 없다(주소 없는 img 를 만들지 않는다).
    expect(await page.locator('main img:not([src])').count()).toBe(0);
    await expect(page.locator(`link[rel="alternate"][hreflang="ko"]`)).toHaveAttribute(
      'href',
      `https://gze1206.net${ko}`,
    );
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'About' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Portfolio' })).toBeVisible();
    await page.getByRole('banner').getByRole('link', { name: '한국어', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${ko}$`, 'u'));
    await expect(page.locator(`link[rel="alternate"][hreflang="en"]`)).toHaveAttribute(
      'href',
      `https://gze1206.net${en}`,
    );
  });
}

for (const [path, name] of [
  ['/', 'English'],
  ['/en', '한국어'],
] as const) {
  test(`NOR-253 AC-1: ${path} 의 언어 전환은 테마 버튼과 같은 둥근 버튼이다`, async ({ page }) => {
    await page.goto(path);
    const banner = page.getByRole('banner');
    const language = banner.getByRole('link', { name, exact: true });
    const theme = banner.locator('[data-theme-toggle]');
    const [lang, toggle] = await Promise.all([language.boundingBox(), theme.boundingBox()]);
    expect(lang?.width).toBe(toggle?.width);
    expect(lang?.height).toBe(toggle?.height);
    // 바로 옆에 붙어 있다(사이 간격이 버튼 하나보다 작다).
    expect((toggle?.x ?? 0) - ((lang?.x ?? 0) + (lang?.width ?? 0))).toBeLessThan(
      toggle?.width ?? 0,
    );
    expect(await language.evaluate((element) => getComputedStyle(element).borderRadius)).toBe(
      await theme.evaluate((element) => getComputedStyle(element).borderRadius),
    );
  });
}
