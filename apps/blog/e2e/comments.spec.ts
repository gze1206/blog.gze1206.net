import { expect, test, type Page } from '@playwright/test';

const SCRIPT = 'https://comments.gze1206.net/comentario.js';

/** 외부 댓글 서버에 실제로 요청하지 않는다. 스크립트 요청 횟수만 센다. */
async function stubCommentsServer(page: Page): Promise<{ requests: () => number }> {
  let count = 0;
  await page.route('https://comments.gze1206.net/**', async (route) => {
    if (route.request().url() === SCRIPT) count += 1;
    await route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
  });
  return { requests: () => count };
}

async function openFirstPost(page: Page): Promise<string> {
  await page.goto('/blog');
  const href = await page.locator('main article a[href^="/blog/"]').first().getAttribute('href');
  expect(href).toBeTruthy();
  await page.goto(href ?? '/');
  return new URL(page.url()).pathname;
}

test('NOR-200 AC-3: 글 상세는 댓글 영역을 두고 가까워질 때 스크립트를 한 번 붙인다', async ({
  page,
}) => {
  const server = await stubCommentsServer(page);
  // 본문이 긴 글이어야 첫 화면에서 댓글 영역이 멀다.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/blog/c-9-0-record-type');
  const path = new URL(page.url()).pathname;
  const section = page.locator('section#comments');
  await expect(section.getByRole('heading', { name: '댓글' })).toHaveCount(1);
  const tag = section.locator('comentario-comments');
  await expect(tag).toHaveAttribute('page-id', path);
  await expect(tag).toHaveAttribute('lang', 'ko');
  await expect(tag).toHaveAttribute('theme', /^(light|dark)$/u);
  await expect(page.locator(`script[src="${SCRIPT}"]`)).toHaveCount(0);

  await section.scrollIntoViewIfNeeded();
  await expect(page.locator(`script[src="${SCRIPT}"]`)).toHaveCount(1);
  await page.mouse.wheel(0, -2000);
  await section.scrollIntoViewIfNeeded();
  await expect(page.locator(`script[src="${SCRIPT}"]`)).toHaveCount(1);
  expect(server.requests()).toBe(1);
});

test('NOR-200 AC-4: 사이트 테마를 바꾸면 댓글 theme 이 따라 바뀐다', async ({ page }) => {
  await stubCommentsServer(page);
  await openFirstPost(page);
  const tag = page.locator('section#comments comentario-comments');
  await expect(tag).toHaveAttribute('theme', /^(light|dark)$/u);
  const before = await tag.getAttribute('theme');
  await page.getByRole('button', { name: /모드로 전환/u }).click();
  await expect(tag).toHaveAttribute('theme', before === 'dark' ? 'light' : 'dark');
});

test('NOR-200 AC-5: 글 상세가 아닌 페이지에는 댓글 영역이 없다', async ({ page }) => {
  await stubCommentsServer(page);
  for (const path of ['/', '/blog', '/about']) {
    await page.goto(path);
    await expect(page.locator('comentario-comments')).toHaveCount(0);
    await expect(page.locator('section#comments')).toHaveCount(0);
  }
});
