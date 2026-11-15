import { expect, test } from '@playwright/test';

const PAGES = [
  '/',
  '/blog',
  '/category/programming',
  '/topics',
  '/about',
  '/portfolio',
  '/books',
  '/blog/c-9-0-record-type',
];

/**
 * 한글이 직접 든 요소의 글자 크기와 첫 폰트. 코드 블록, SVG(viewBox 로 크기가 바뀐다),
 * 장식으로 숨긴 요소(aria-hidden, 예: 본문과 같은 내용을 그린 책 표지)는 뺀다.
 */
async function hangulText(page: import('@playwright/test').Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter(
        (el) =>
          !el.closest('pre, code, script, style, noscript, svg, [aria-hidden="true"], .sr-only'),
      )
      .filter((el) =>
        [...el.childNodes].some(
          (node) => node.nodeType === 3 && /[가-힣]/u.test(node.textContent ?? ''),
        ),
      )
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const style = getComputedStyle(el);
        return {
          label: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent?.trim().slice(0, 16)}"`,
          size: parseFloat(style.fontSize),
          first:
            style.fontFamily
              .split(',')[0]
              ?.trim()
              .replace(/^["']|["']$/gu, '') ?? '',
        };
      }),
  );
}

for (const path of PAGES) {
  test(`NOR-202 AC-2, AC-3: ${path} 의 한글은 12px 이상이고 고정폭 폰트로 시작하지 않는다`, async ({
    page,
  }) => {
    await page.route('https://comments.gze1206.net/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }),
    );
    await page.goto(path);
    const items = await hangulText(page);
    expect(items.length).toBeGreaterThan(0);
    expect(
      items.filter((item) => item.size < 12).map((item) => `${item.label} ${item.size}px`),
    ).toEqual([]);
    const mono = /^(ui-monospace|SFMono-Regular|Menlo|Monaco|Consolas|monospace)$/u;
    expect(items.filter((item) => mono.test(item.first)).map((item) => item.label)).toEqual([]);
  });
}
