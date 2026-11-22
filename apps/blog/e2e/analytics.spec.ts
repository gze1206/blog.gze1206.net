import { expect, test } from '@playwright/test';

const POST = '/blog/c-9-0-record-type';

type Pushed = { 0?: unknown; 1?: unknown; 2?: Record<string, unknown> };
const readEvents = () =>
  ((window as unknown as { dataLayer?: Pushed[] }).dataLayer ?? [])
    .filter((entry) => entry[0] === 'event' && entry[1] === 'read_complete')
    .map((entry) => entry[2] ?? {});

test('NOR-234 AC-2: 로컬 미리보기에서는 GA 로 요청을 보내지 않는다', async ({ page }) => {
  const google: string[] = [];
  page.on('request', (request) => {
    if (/googletagmanager\.com|google-analytics\.com/u.test(request.url()))
      google.push(request.url());
  });
  await page.goto(POST);
  await page.waitForLoadState('networkidle');
  await page.mouse.wheel(0, 50_000);
  await page.waitForTimeout(500);
  expect(google).toEqual([]);
});

test('NOR-234 AC-5: 끝까지 내리고 충분히 머물면 read_complete 를 한 번 보낸다', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto(POST);
  const minutes = Number(
    (await page.locator('.article__meta time[datetime^="PT"]').getAttribute('datetime'))?.match(
      /PT(\d+)M/u,
    )?.[1],
  );
  expect(minutes).toBeGreaterThan(0);

  // 끝에 닿기 전에는 아무리 오래 있어도 보내지 않는다.
  await page.clock.runFor(minutes * 60_000);
  expect(await page.evaluate(readEvents)).toEqual([]);

  await page.locator('.article__after').scrollIntoViewIfNeeded();
  await page.clock.runFor(1_000);
  const events = await page.evaluate(readEvents);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ reading_minutes: minutes });

  await page.mouse.wheel(0, -2000);
  await page.locator('.article__after').scrollIntoViewIfNeeded();
  await page.clock.runFor(60_000);
  expect(await page.evaluate(readEvents)).toHaveLength(1);
});

test('NOR-234 AC-5: 탭이 숨은 동안의 시간은 세지 않는다', async ({ page }) => {
  await page.clock.install();
  await page.goto(POST);
  await page.locator('.article__after').scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(3_600_000);
  expect(await page.evaluate(readEvents)).toEqual([]);
});

test('NOR-234 AC-6: 푸터에서 개인정보 처리방침으로 가고, 무엇을 모으는지 알린다', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: '개인정보 처리방침' }).click();
  await expect(page).toHaveURL(/\/privacy$/u);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('개인정보 처리방침');
  await expect(main).toContainText('Google Analytics');
  await expect(main).toContainText('Cloudflare Web Analytics');
  await expect(main).toContainText('댓글');
  await expect(main.getByRole('link', { name: /차단 부가기능/u })).toHaveAttribute(
    'href',
    'https://tools.google.com/dlpage/gaoptout',
  );
});
