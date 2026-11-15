import { expect, test, type Page } from '@playwright/test';
import { buildCsp, inlineScriptHashes } from '../src/lib/csp.ts';

/** 문서 응답에 그 페이지로 만든 CSP 를 강제로 붙이고, 위반을 모은다. */
async function enforceCsp(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const store: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = store;
    document.addEventListener('securitypolicyviolation', (event) =>
      store.push(`${event.violatedDirective} ${event.blockedURI}`),
    );
  });
  await page.route('https://comments.gze1206.net/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }),
  );
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    const body = await response.text();
    const headers = {
      ...response.headers(),
      'content-security-policy': buildCsp(inlineScriptHashes(body)),
    };
    await route.fulfill({ response, body, headers });
  });
  return () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
}

for (const path of [
  '/',
  '/blog',
  '/blog/c-9-0-record-type',
  '/smoke/math-mermaid',
  '/smoke/codeblock',
  '/smoke/blocks',
  '/smoke/cil',
  '/smoke/markdoc',
]) {
  test(`NOR-201 AC-5: ${path} 는 강제 CSP 에서 위반이 없다`, async ({ page }) => {
    const violations = await enforceCsp(page);
    const response = await page.goto(path);
    expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
    await page.mouse.wheel(0, 20000);
    await page.waitForLoadState('networkidle');
    expect(await violations()).toEqual([]);
  });
}

test('NOR-201 AC-5: 검색 팔레트와 테마 전환은 강제 CSP 에서 위반이 없다', async ({ page }) => {
  const violations = await enforceCsp(page);
  await page.goto('/blog');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
  await page.getByRole('button', { name: /모드로 전환/u }).click();
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByRole('dialog', { name: '블로그 검색' }).getByRole('combobox');
  await input.fill('블로그');
  await page.waitForLoadState('networkidle');
  expect(await violations()).toEqual([]);
});
