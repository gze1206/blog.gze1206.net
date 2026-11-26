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

test('NOR-238 AC-1: 오늘의 할 일을 손가락으로 완료·취소하고 유형을 바꾼다', async ({ page }) => {
  await page.goto('/');
  const capture = page.getByLabel('빠른 불렛 입력');
  await page
    .getByRole('group', { name: '불렛 유형' })
    .getByRole('button', { name: /할 일/u })
    .tap();
  await capture.fill('손가락 할 일');
  await page.getByRole('button', { name: '추가', exact: true }).tap();
  const task = page
    .getByTestId('day-bullets')
    .getByRole('listitem')
    .filter({ hasText: '손가락 할 일' });
  await expect(task).toContainText('□');

  await task.getByRole('button', { name: '손가락 할 일 완료' }).tap();
  await expect(task).toContainText('▣');
  await task.getByRole('button', { name: '손가락 할 일 다시 열기' }).tap();
  await expect(task).toContainText('□');
  await task.getByRole('button', { name: '손가락 할 일 취소' }).tap();
  await expect(task).toContainText('⨯');
  await expect(task.getByRole('button', { name: '손가락 할 일 취소' })).toHaveCount(0);
  await task.getByRole('button', { name: '손가락 할 일 다시 열기' }).tap();
  await task.getByRole('button', { name: '손가락 할 일 유형 바꾸기' }).tap();
  await expect(task).toContainText('•');
});

test('NOR-238 AC-2: 지난 할 일을 검토 목록에서 완료·취소한다', async ({ page }) => {
  await page.goto('/');
  const review = page.getByRole('region', { name: '지난 미완료 검토' });
  await review.getByRole('button', { name: '손으로 끝낼 일 완료' }).tap();
  await expect(review).not.toContainText('손으로 끝낼 일');
  await review.getByRole('button', { name: '손으로 그만둘 일 취소' }).tap();
  await expect(review).not.toContainText('손으로 그만둘 일');
  await page.reload();
  await expect(page.getByRole('region', { name: '지난 미완료 검토' })).not.toContainText('손으로');
});

test('NOR-238 AC-3: 도구 막대 버튼으로 줄을 들이고 내민다', async ({ page }) => {
  await page.goto('/');
  await openMenu(page);
  // 다른 시험이 쓰는 문서를 고치지 않게 새 문서를 만든다.
  await page.getByLabel('새 문서 제목').fill('들여쓰기 시험');
  await page.getByRole('button', { name: /capture$/u }).tap();
  const editor = page.getByLabel('Markdown 문서');
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('\n- 항목');
  const line = page.locator('.cm-line').filter({ hasText: '항목' });
  const indent = () => line.evaluate((element) => element.textContent?.match(/^\s*/u)?.[0].length);
  await page.getByRole('button', { name: '들여쓰기' }).tap();
  await expect.poll(indent).toBeGreaterThan(0);
  await page.getByRole('button', { name: '내어쓰기' }).tap();
  await expect.poll(indent).toBe(0);
});

test('NOR-238 AC-4: 좁은 화면에서 불렛 버튼은 40px 이상이고 단축키 안내는 숨는다', async ({
  page,
}) => {
  await page.goto('/');
  // 다른 시험에 기대지 않도록 자기 할 일을 하나 만든다.
  await page
    .getByRole('group', { name: '불렛 유형' })
    .getByRole('button', { name: /할 일/u })
    .tap();
  await page.getByLabel('빠른 불렛 입력').fill('크기 재는 할 일');
  await page.getByRole('button', { name: '추가', exact: true }).tap();
  const buttons = page
    .getByTestId('day-bullets')
    .getByRole('listitem')
    .filter({ hasText: '크기 재는 할 일' })
    .getByRole('button');
  await expect(buttons.first()).toBeVisible();
  for (const box of await buttons.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect()),
  )) {
    expect(box.width).toBeGreaterThanOrEqual(40);
    expect(box.height).toBeGreaterThanOrEqual(40);
  }
  await expect(page.getByText(/Alt\+Enter/u)).toBeHidden();
});

test('NOR-239 AC-3: 체크박스를 눌러 원본을 바꾸고, 도구 막대로 체크리스트를 넣는다', async ({
  page,
}) => {
  await page.goto('/');
  await openMenu(page);
  await page.getByLabel('새 문서 제목').fill('체크리스트 시험');
  await page.getByRole('button', { name: /capture$/u }).tap();
  const editor = page.getByLabel('Markdown 문서');
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  // 템플릿의 마지막 줄에 붙지 않게 빈 줄에서 시작한다.
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '체크리스트' }).tap();
  await page.keyboard.type('우유 사기');
  await expect(page.locator('.cm-line').filter({ hasText: '- [ ] 우유 사기' })).toBeVisible();
  // 다른 줄로 커서를 옮기면 체크박스가 보인다.
  await page.keyboard.press('Enter');
  await page.keyboard.type('다음 줄');
  const box = page.getByRole('checkbox', { name: '우유 사기' });
  await expect(box).not.toBeChecked();
  await box.tap();
  await expect(box).toBeChecked();
  // 누른 줄로 커서가 옮겨 가지 않았으므로 원본 표시가 드러나지 않는다.
  await expect(page.locator('.cm-line').filter({ hasText: '[x]' })).toHaveCount(0);
  await expect(page.locator('.cm-line.cm-lp-task-done')).toContainText('우유 사기');
});

test('NOR-243 AC-5: 휴대폰 화면에서 일정 화면과 대화 상자가 가로로 넘치지 않는다', async ({
  page,
}) => {
  await page.goto('/');
  await openMenu(page);
  await page.getByRole('button', { name: '일정', exact: true }).tap();
  await expect(page.getByRole('grid', { name: '월 달력' })).toBeVisible();
  expect(await overflowing(page), '일정 화면').toEqual([]);
  await page.getByRole('button', { name: '새 일정' }).tap();
  const dialog = page.getByRole('dialog', { name: '새 일정' });
  await dialog.getByLabel('반복').selectOption('weekly');
  await expect(dialog).toBeVisible();
  expect(await overflowing(page), '일정 대화 상자').toEqual([]);
  const box = await dialog.boundingBox();
  expect(box?.width ?? 999).toBeLessThanOrEqual(390);
  // 화면보다 긴 대화 상자도 위가 잘리지 않고, 스크롤해 저장할 수 있다.
  expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
  await dialog.getByLabel('제목').fill('휴대폰 일정');
  await dialog.getByRole('button', { name: '저장' }).tap();
  await expect(dialog).toBeHidden();
});

test('NOR-245 AC-1, NOR-245 AC-2, NOR-245 AC-3: Enter 로 목록·체크리스트를 이어 쓰고 빈 항목에서 끝낸다', async ({
  page,
}) => {
  await page.goto('/');
  await openMenu(page);
  await page.getByLabel('새 문서 제목').fill('이어쓰기 시험');
  await page.getByRole('button', { name: /capture$/u }).tap();
  const editor = page.getByLabel('Markdown 문서');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  const source = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.cm-line')].map((line) => line.textContent ?? '').join('\n'),
    );

  await page.keyboard.type('- 우유');
  await page.keyboard.press('Enter');
  await page.keyboard.type('빵');
  await expect.poll(source).toContain('빵');
  await expect(page.locator('.cm-line').filter({ hasText: /^- 빵$/u })).toHaveCount(1);
  // 빈 항목에서 Enter 를 누르면 목록이 끝난다.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('목록 밖');
  await expect(page.locator('.cm-line').filter({ hasText: /^목록 밖$/u })).toHaveCount(1);

  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '체크리스트' }).tap();
  await page.keyboard.type('할 일 하나');
  await page.keyboard.press('Enter');
  await page.keyboard.type('할 일 둘');
  await expect(page.locator('.cm-line').filter({ hasText: /^- \[ \] 할 일 둘$/u })).toHaveCount(1);

  await page.keyboard.press('Enter');
  await page.keyboard.type('1. 첫째');
  await page.keyboard.press('Enter');
  await expect(page.locator('.cm-line').filter({ hasText: /^2\. $/u })).toHaveCount(1);
  // 표시만 있는 줄에서 Backspace 를 누르면 표시가 지워진다.
  await page.keyboard.press('Backspace');
  await page.keyboard.type('번호 밖');
  await expect(page.locator('.cm-line').filter({ hasText: /^번호 밖$/u })).toHaveCount(1);
});
