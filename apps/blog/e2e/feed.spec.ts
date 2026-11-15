import { expect, test } from '@playwright/test';

test('NOR-197 AC-11: RSS는 공개 글 전체를 XML로 제공한다', async ({ page, request }) => {
  const posts = new Set<string>();
  let path = '/blog';
  for (;;) {
    await page.goto(path);
    for (const href of await page
      .locator('main article h2 a')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute('href'))
          .filter((href): href is string => href !== null),
      ))
      posts.add(href);
    const next = page.locator('main a[rel="next"]');
    const href = (await next.count()) ? await next.getAttribute('href') : null;
    if (!href) break;
    path = href;
  }
  expect(posts.size).toBeGreaterThan(0);
  const response = await request.get('/rss.xml');
  expect(response.ok()).toBeTruthy();
  expect(response.headers()['content-type']).toMatch(/(?:application|text)\/(?:rss\+)?xml/u);
  const xml = await response.text();
  const count = await page.evaluate((body) => {
    const document = new DOMParser().parseFromString(body, 'application/xml');
    if (document.querySelector('parsererror')) throw new Error('Invalid RSS XML');
    return document.querySelectorAll('rss channel item').length;
  }, xml);
  expect(count).toBe(posts.size);
});
