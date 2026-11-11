import { expect, test } from '@playwright/test';

test('creates and edits a document without sending a filesystem path', async ({ page }) => {
  let createPayload: unknown;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/documents')) {
      createPayload = request.postDataJSON();
    }
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Workbench' })).toBeVisible();
  await expect(page.getByRole('button', { name: /빠른 메모/u })).toBeVisible();

  await page.getByLabel('새 문서 제목').fill('Quick capture');
  await page.getByRole('button', { name: /빠른 메모/u }).click();
  expect(createPayload).toEqual({ templateId: 'capture', title: 'Quick capture' });

  const editor = page.getByLabel('Markdown 문서');
  await expect(editor).toContainText('title: Quick capture');
  await editor.fill(`${await editor.inputValue()}\n- • 첫 기록\n`);
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장됨' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Quick capture/u })).toBeVisible();

  await page.getByRole('button', { name: /주간 회고/u }).click();
  await expect(page.getByRole('alert')).toContainText('YYYY-Www');
  await page.getByLabel('회고 기간').fill('2026-W33');
  await page.getByRole('button', { name: /주간 회고/u }).click();
  await expect(editor).toContainText('period: 2026-W33');
  await expect(editor).toContainText('# 2026-W33 주간 회고');
});

test('stores Later locally and Skip suppresses only that review period on the next app open', async ({
  page,
}) => {
  await page.goto('/day/2026-08-12');
  const prompt = page.getByRole('region', { name: '회고 제안' });
  await expect(prompt).toContainText('2026-W32');

  await prompt.getByRole('button', { name: '나중에' }).click();
  await expect(prompt).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('workbench.review.later')))
    .not.toBeNull();

  await page.reload();
  await expect(prompt).toContainText('2026-W32');
  await prompt.getByRole('button', { name: '건너뛰기' }).click();

  await page.reload();
  await expect(prompt).toContainText('2026-07');
  await expect(prompt).not.toContainText('2026-W32');
});

test('offers one nonmodal review only on app open and creates it with a selected bullet link', async ({
  page,
}) => {
  let suggestionRequests = 0;
  let suggestionUrl = '';
  let reviewCreatePayload: Record<string, unknown> | undefined;
  let releaseDay!: () => void;
  const dayGate = new Promise<void>((resolve) => {
    releaseDay = resolve;
  });
  await page.route('**/api/days/2026-08-12', async (route) => {
    await dayGate;
    await route.continue();
  });
  page.on('request', (request) => {
    if (request.url().includes('/api/reviews/suggestion')) {
      suggestionRequests += 1;
      suggestionUrl = request.url();
    }
    if (request.method() === 'POST' && request.url().endsWith('/api/reviews')) {
      reviewCreatePayload = request.postDataJSON() as Record<string, unknown>;
    }
  });

  const suggestionResponse = page.waitForResponse((response) =>
    response.url().includes('/api/reviews/suggestion'),
  );
  await page.goto('/day/2026-08-12');

  const prompt = page.getByRole('region', { name: '회고 제안' });
  await suggestionResponse;
  await page.waitForTimeout(100);
  await expect(prompt).toHaveCount(0);
  releaseDay();
  await expect(prompt).toContainText('2026-W32');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('첫 번째 남은 일 회고 링크').check();
  await prompt.getByRole('button', { name: '작성' }).click();

  const editor = page.getByLabel('Markdown 문서');
  await expect(editor).toContainText('period: 2026-W32');
  await expect(editor).toContainText(
    '[첫 번째 남은 일](/day/2026-08-11#bullet-01J5AR7W6M3Q9N8K2T4V1X0ZBC)',
  );
  await page.getByRole('button', { name: '오늘의 로그' }).click();
  await expect(prompt).toHaveCount(0);
  expect(suggestionRequests).toBe(1);
  expect(new URL(suggestionUrl).searchParams.has('timeZone')).toBe(false);
  expect(reviewCreatePayload).not.toHaveProperty('timeZone');
});

test('keeps older tasks in review until quick migration is explicitly confirmed', async ({
  page,
}) => {
  await page.goto('/day/2026-08-12');

  await expect(page.getByRole('heading', { name: '2026-08-12 일일 로그' })).toBeVisible();
  await expect(page.getByTestId('day-bullets').getByText('첫 번째 남은 일')).toHaveCount(0);
  await expect(page.getByRole('region', { name: '지난 미완료 검토' })).toContainText(
    '첫 번째 남은 일',
  );

  await page.getByRole('button', { name: '첫 번째 남은 일 간편 이월' }).click();
  await expect(page.getByRole('dialog', { name: '간편 이월' })).toBeVisible();
  await page.getByRole('button', { name: '이월 확인' }).click();

  await expect(page.getByTestId('day-bullets')).toContainText('첫 번째 남은 일');
  await expect(page.getByRole('region', { name: '지난 미완료 검토' })).not.toContainText(
    '첫 번째 남은 일',
  );
});

test('requires the intentional phrase and supports keyboard-first capture and transitions', async ({
  page,
}) => {
  await page.goto('/day/2026-08-12');

  await page.getByRole('button', { name: '두 번째 남은 일 의식적 이월' }).click();
  const dialog = page.getByRole('dialog', { name: '의식적 이월' });
  await expect(dialog.getByRole('button', { name: '이월 확인' })).toBeDisabled();
  await dialog.getByLabel('확인 문구').fill('오늘도 이 일을 선택합니다');
  await dialog.getByRole('button', { name: '이월 확인' }).click();
  await expect(page.getByTestId('day-bullets')).toContainText('두 번째 남은 일');

  const capture = page.getByLabel('빠른 불렛 입력');
  await capture.focus();
  await page.keyboard.press('Alt+4');
  await capture.fill('키보드로 추가한 할 일');
  await page.keyboard.press('Enter');
  const task = page.getByRole('listitem').filter({ hasText: '키보드로 추가한 할 일' });
  await expect(task).toContainText('□');
  await task.focus();
  await page.keyboard.press('Alt+Enter');
  await expect(task).toContainText('▣');
  await page.keyboard.press('Alt+ArrowRight');
  await expect(task).toContainText('•');
});

test('reviews a public draft before explicitly creating an outbox publish artifact', async ({
  page,
}) => {
  let reviewPayload: unknown;
  let confirmPayload: unknown;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/publish/review')) reviewPayload = request.postDataJSON();
    if (request.url().endsWith('/api/publish/confirm')) confirmPayload = request.postDataJSON();
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Asset publish public-draft/u }).click();
  await page.getByLabel('images/flow.png (14 B)').check();
  await page.getByRole('button', { name: '발행 검토' }).click();

  await expect(page.getByRole('heading', { name: '공개 발행 검토' })).toBeVisible();
  await expect(page.getByText('asset-publish', { exact: true })).toBeVisible();
  await expect(
    page.getByText('src/content/posts/asset-publish.mdoc', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('통합 diff')).toContainText(
    '+++ b/src/content/posts/asset-publish.mdoc',
  );
  await expect(
    page.getByText('public/assets/posts/asset-publish/images/flow.png', { exact: true }),
  ).toBeVisible();
  expect(reviewPayload).toMatchObject({
    assetIds: [expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u)],
  });
  expect(reviewPayload).toHaveProperty('id');
  expect(reviewPayload).not.toHaveProperty('source');
  expect(reviewPayload).not.toHaveProperty('assets');

  const confirmButton = page.getByRole('button', { name: 'outbox 산출물 생성' });
  await expect(confirmButton).toBeDisabled();
  await page.getByLabel('검토 내용을 확인했습니다').check();
  await confirmButton.click();
  await expect(page.getByRole('status')).toContainText('outbox에');
  await expect(page.getByRole('status')).toContainText('git bundle verify');
  await expect(page.getByRole('status')).toContainText('git merge-base --is-ancestor');
  expect(confirmPayload).toMatchObject({
    assetIds: [expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u)],
    confirmPublish: true,
  });
  expect(confirmPayload).not.toHaveProperty('source');
  expect(confirmPayload).not.toHaveProperty('assets');
});
