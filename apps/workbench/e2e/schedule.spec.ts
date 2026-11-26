import { expect, type Page, test } from '@playwright/test';

// 일정 화면(NOR-243). 픽스처의 오늘은 2026-08-12(수)다.
async function openSchedule(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '일정', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2026년 8월' })).toBeVisible();
}

const cell = (page: Page, date: string) =>
  page
    .getByRole('grid', { name: '월 달력' })
    .getByRole('button', { name: new RegExp(`^${date}`, 'u') });
const dayList = (page: Page, date: string) => page.getByRole('region', { name: `${date} 일정` });

test('NOR-243 AC-1: 월 달력은 일요일부터 42칸이고 달을 옮긴다', async ({ page }) => {
  await openSchedule(page);
  const grid = page.getByRole('grid', { name: '월 달력' });
  await expect(grid.getByRole('button')).toHaveCount(42);
  await expect(grid.getByRole('button').first()).toHaveAccessibleName(/^2026-07-26/u);
  await expect(dayList(page, '2026-08-12')).toBeVisible();
  await page.getByRole('button', { name: '다음 달' }).click();
  await expect(page.getByRole('heading', { name: '2026년 9월' })).toBeVisible();
  await page.getByRole('button', { name: '이전 달' }).click();
  await page.getByRole('button', { name: '이전 달' }).click();
  await expect(page.getByRole('heading', { name: '2026년 7월' })).toBeVisible();
  await page.getByRole('button', { name: '오늘', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2026년 8월' })).toBeVisible();
  await cell(page, '2026-08-20').click();
  await expect(dayList(page, '2026-08-20')).toBeVisible();
});

test('NOR-243 AC-2, NOR-243 AC-3, NOR-243 AC-4: 반복 일정을 만들고 회차를 고치고 지우며 일일 로그에서 본다', async ({
  page,
}) => {
  await openSchedule(page);
  await page.getByRole('button', { name: '새 일정' }).click();
  const dialog = page.getByRole('dialog', { name: '새 일정' });
  await dialog.getByLabel('제목').fill('주간 회의');
  await dialog.getByLabel('종일').uncheck();
  await dialog.getByLabel('시작 시각').fill('10:00');
  await dialog.getByLabel('끝 시각').fill('11:00');
  await dialog.getByLabel('반복').selectOption('weekly');
  await dialog.getByRole('button', { name: '저장' }).click();
  await expect(dialog).toBeHidden();
  await expect(dayList(page, '2026-08-12')).toContainText('10:00');
  await expect(dayList(page, '2026-08-12')).toContainText('주간 회의');
  await expect(cell(page, '2026-08-19')).toHaveAccessibleName(/일정 1개/u);

  // 한 회차만 고친다.
  await cell(page, '2026-08-19').click();
  await dayList(page, '2026-08-19')
    .getByRole('button', { name: /\d{2}:\d{2}.*주간 회의/u })
    .click();
  const edit = page.getByRole('dialog', { name: '일정 고치기' });
  await expect(edit.getByLabel('날짜', { exact: true })).toHaveValue('2026-08-19');
  await edit.getByLabel('제목').fill('옮긴 회의');
  await edit.getByRole('button', { name: '저장' }).click();
  const scope = page.getByRole('dialog', { name: '반복 일정 고치기' });
  await scope.getByLabel('이 일정만').check();
  await scope.getByRole('button', { name: '확인' }).click();
  await expect(dayList(page, '2026-08-19')).toContainText('옮긴 회의');
  await cell(page, '2026-08-26').click();
  await expect(dayList(page, '2026-08-26')).toContainText('주간 회의');

  // 이후 모든 일정을 지운다.
  await dayList(page, '2026-08-26')
    .getByRole('button', { name: /\d{2}:\d{2}.*주간 회의/u })
    .click();
  await page
    .getByRole('dialog', { name: '일정 고치기' })
    .getByRole('button', { name: '삭제' })
    .click();
  const remove = page.getByRole('dialog', { name: '반복 일정 지우기' });
  await remove.getByLabel('이후 모든 일정').check();
  await remove.getByRole('button', { name: '확인' }).click();
  await expect(dayList(page, '2026-08-26')).not.toContainText('주간 회의');
  await expect(cell(page, '2026-09-02')).not.toHaveAccessibleName(/일정/u);
  await expect(cell(page, '2026-08-12')).toHaveAccessibleName(/일정 1개/u);

  // 일일 로그에서 그날의 일정을 보고 일정 화면으로 간다.
  await page.getByRole('button', { name: '오늘의 로그' }).click();
  const today = page.getByRole('region', { name: '이날의 일정' });
  await expect(today).toContainText('주간 회의');
  await today.getByRole('button', { name: '일정 열기' }).click();
  await expect(dayList(page, '2026-08-12')).toContainText('주간 회의');
});
