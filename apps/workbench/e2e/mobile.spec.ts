import { expect, type Page, test } from '@playwright/test';

// 휴대폰 화면(NOR-233). Desktop Chrome 프로젝트 안에서 화면 크기와 터치만 바꾼다.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

/**
 * 가로로 넘친 곳을 찾는다. 페이지 자체가 넓어졌거나, 세로 스크롤 칸 안의 내용이 옆으로 밀려
 * 가로 스크롤이 생긴 경우다. 코드 블록·편집기처럼 가로 스크롤을 일부러 허용한 칸은 뺀다.
 */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + 1) found.push(`html ${root.scrollWidth}px`);
    for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
      if (element.matches('pre, .cm-scroller, .overflow-x-auto, .overflow-x-auto *')) continue;
      const style = getComputedStyle(element);
      if (style.overflowX !== 'auto' && style.overflowX !== 'scroll') continue;
      if (element.scrollWidth > element.clientWidth + 1) {
        found.push(
          `${element.tagName.toLowerCase()}.${element.className} ${element.scrollWidth}px`,
        );
      }
    }
    return found;
  });
}

async function openMenu(page: Page) {
  await page.getByRole('button', { name: '메뉴 열기' }).click();
  await expect(page.getByRole('complementary', { name: '사이드바' })).toBeVisible();
}

test('NOR-233 AC-1: 휴대폰 화면에서 각 화면이 가로로 넘치지 않는다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /일일 로그/u })).toBeVisible();
  expect(await overflowing(page), '오늘의 로그').toEqual([]);

  await openMenu(page);
  await page.getByRole('button', { name: /^Asset publish/u }).click();
  await expect(page.getByLabel('Markdown 문서')).toBeVisible();
  expect(await overflowing(page), '문서 편집기').toEqual([]);

  await page.getByRole('button', { name: '나란히' }).click();
  await expect(page.getByRole('region', { name: '미리보기' })).toBeVisible();
  expect(await overflowing(page), '나란히 보기').toEqual([]);

  // 본문이 이미지를 가리키므로 자산을 골라야 검토가 열린다.
  await page.getByLabel('images/flow.png (14 B)').check();
  await page.getByRole('button', { name: '발행 검토' }).click();
  await expect(page.getByRole('heading', { name: '공개 발행 검토' })).toBeVisible();
  expect(await overflowing(page), '발행 검토').toEqual([]);
  await page.getByRole('button', { name: '편집기로 돌아가기' }).click();

  await openMenu(page);
  await page.getByRole('button', { name: /인용 테스트.*책/u }).click();
  await expect(page.getByRole('region', { name: '책 편집기' })).toBeVisible();
  expect(await overflowing(page), '책 편집기').toEqual([]);

  await openMenu(page);
  await page.getByRole('button', { name: '사이트 콘텐츠' }).click();
  const site = page.getByRole('region', { name: '사이트 콘텐츠' });
  await site.getByRole('button', { name: 'E2E 시리즈' }).click();
  await expect(site.getByLabel('설명')).toBeVisible();
  expect(await overflowing(page), '사이트 콘텐츠').toEqual([]);
});

test('NOR-233 AC-2: 좁은 화면에서는 사이드바를 서랍으로 열고 닫는다', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: '사이드바' });
  const menu = page.getByRole('button', { name: '메뉴 열기' });
  await expect(sidebar).toBeHidden();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');

  await menu.click();
  await expect(sidebar).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: /^Asset publish/u }).click();
  await expect(sidebar).toBeHidden();
  await expect(page.getByLabel('Markdown 문서')).toBeVisible();

  await menu.click();
  await page.keyboard.press('Escape');
  await expect(sidebar).toBeHidden();
  await expect(menu).toBeFocused();

  await menu.click();
  await page.getByTestId('sidebar-scrim').click({ position: { x: 360, y: 400 } });
  await expect(sidebar).toBeHidden();

  await menu.click();
  await page.getByRole('button', { name: '오늘의 로그' }).click();
  await expect(sidebar).toBeHidden();
  await expect(page.getByRole('heading', { name: /일일 로그/u })).toBeVisible();
});

test('NOR-233 AC-2: 넓은 화면에서는 메뉴 버튼 없이 사이드바가 늘 보인다', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: '사이드바' })).toBeVisible();
  await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeHidden();
});

test('NOR-233 AC-3: 좁은 화면에서 입력 칸 글자는 16px 이상이다', async ({ page }) => {
  await page.goto('/');
  await openMenu(page);
  const fontSize = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(await fontSize('input[aria-label="새 문서 제목"]')).toBeGreaterThanOrEqual(16);

  await page.getByRole('button', { name: /^Asset publish/u }).click();
  await expect(page.getByLabel('Markdown 문서')).toBeVisible();
  expect(await fontSize('.cm-content')).toBeGreaterThanOrEqual(16);
});
