import { expect, type Page, test } from '@playwright/test';

test('creates and edits a document without sending a filesystem path', async ({ page }) => {
  let createPayload: unknown;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/documents')) {
      createPayload = request.postDataJSON();
    }
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Workbench' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Templates' }).getByRole('button', { name: /빠른 메모/u }),
  ).toBeVisible();

  await page.getByLabel('새 문서 제목').fill('Quick capture');
  await page
    .getByRole('region', { name: 'Templates' })
    .getByRole('button', { name: /빠른 메모/u })
    .click();
  expect(createPayload).toEqual({ templateId: 'capture', title: 'Quick capture' });

  const editor = page.getByLabel('Markdown 문서');
  await expect(editor).toContainText('title: Quick capture');
  await appendToEditor(page, '\n- • 첫 기록\n');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장됨' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Quick capture/u })).toBeVisible();

  await page
    .getByRole('region', { name: 'Templates' })
    .getByRole('button', { name: /주간 회고/u })
    .click();
  await expect(page.getByRole('alert')).toContainText('YYYY-Www');
  await page.getByLabel('회고 기간').fill('2026-W33');
  await page
    .getByRole('region', { name: 'Templates' })
    .getByRole('button', { name: /주간 회고/u })
    .click();
  await expect(editor).toContainText('period: 2026-W33');
  await expect(editor.locator('.cm-lp-h1')).toHaveText('2026-W33 주간 회고');
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
  // 커서가 없는 줄은 링크 표시 문자를 숨긴다. 줄을 눌러 원본을 드러낸 뒤 확인한다(NOR-206 AC-6).
  await editor.locator('.cm-lp-link').click();
  await expect(editor.locator('.cm-line').filter({ hasText: '](/day/' })).toContainText(
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
  await page.getByRole('button', { name: /^Asset publish/u }).click();
  await page.getByLabel('images/flow.png (14 B)').check();
  await page.getByRole('button', { name: '발행 검토' }).click();

  await expect(page.getByRole('heading', { name: '공개 발행 검토' })).toBeVisible();
  await expect(page.getByText('asset-publish', { exact: true })).toBeVisible();
  await expect(
    page.getByText('apps/blog/src/content/posts/asset-publish.mdoc', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('통합 diff')).toContainText(
    '+++ b/apps/blog/src/content/posts/asset-publish.mdoc',
  );
  await expect(
    page.getByText('apps/blog/public/assets/posts/asset-publish/images/flow.png', { exact: true }),
  ).toBeVisible();
  expect(reviewPayload).toMatchObject({
    assetIds: [expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u)],
  });
  expect(reviewPayload).toHaveProperty('id');
  expect(reviewPayload).not.toHaveProperty('source');
  expect(reviewPayload).not.toHaveProperty('assets');

  const confirmButton = page.getByRole('button', { name: '발행', exact: true });
  await expect(confirmButton).toBeDisabled();
  await page.getByLabel('검토 내용을 확인했습니다').check();
  await confirmButton.click();
  await expect(page.getByRole('status')).toContainText('PR');
  await expect(page.getByRole('status')).not.toContainText('git bundle verify');
  expect(confirmPayload).toMatchObject({
    assetIds: [expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u)],
    confirmPublish: true,
  });
  expect(confirmPayload).not.toHaveProperty('source');
  expect(confirmPayload).not.toHaveProperty('assets');
});

test('NOR-196 AC-16: 공개 구절을 글 발행 검토에서 펼친다', async ({ page }) => {
  const patches: unknown[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/excerpts/0'))
      patches.push(request.postDataJSON());
  });
  await page.goto('/');
  await page.getByRole('button', { name: /인용 테스트.*책/u }).click();
  for (const value of [true, false, true]) {
    const refreshed = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' && response.url().includes('/api/documents/'),
    );
    await page.getByLabel('공개', { exact: true }).click();
    await refreshed;
    await expect(page.getByLabel('공개', { exact: true })).toBeEnabled();
    await expect(page.getByLabel('공개', { exact: true })).toHaveJSProperty('checked', value);
  }
  expect(patches).toEqual([
    expect.objectContaining({ text: '공개할 문장', public: true }),
    expect.objectContaining({ text: '공개할 문장', public: false }),
    expect.objectContaining({ text: '공개할 문장', public: true }),
  ]);
  await page.getByRole('button', { name: /^Quote test/u }).click();
  await page.getByRole('button', { name: '발행 검토' }).click();
  await expect(page.getByLabel('통합 diff')).toContainText('{% bookquote book=');
});

test('NOR-203 AC-5: 테마 전환은 html.dark 를 바꾸고 새로고침 뒤에도 유지된다', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/day/2026-08-12');
  const html = page.locator('html');
  await expect(html).not.toHaveClass(/\bdark\b/u);
  const toDark = page.getByRole('button', { name: /다크 모드로 전환/u });
  await expect(toDark).toBeVisible();
  await toDark.click();
  await expect(html).toHaveClass(/\bdark\b/u);
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/u);
  await page.getByRole('button', { name: /라이트 모드로 전환/u }).click();
  await expect(html).not.toHaveClass(/\bdark\b/u);
});

test('NOR-203 AC-6: 추가 버튼은 한 줄이고 본문 글꼴은 Pretendard 다', async ({ page }) => {
  await page.goto('/day/2026-08-12');
  const add = page.getByRole('button', { name: '추가', exact: true });
  await expect(add).toBeVisible();
  const { height, lineHeight } = await add.evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    lineHeight: parseFloat(getComputedStyle(el).lineHeight),
  }));
  expect(height).toBeLessThan(lineHeight * 2 + 16);
  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family).toMatch(/^"?Pretendard/u);
});

test('NOR-205 AC-5: 문서를 지우면 휴지통으로 가고 복원하면 돌아온다', async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto('/');
  await page.getByLabel('새 문서 제목').fill('지울 문서');
  await page
    .getByRole('region', { name: 'Templates' })
    .getByRole('button', { name: /빠른 메모/u })
    .click();
  const remove = page.getByRole('button', { name: '삭제', exact: true });
  await expect(remove).toBeVisible();
  await remove.click();
  const documents = page.getByRole('region', { name: 'Documents' });
  await expect(page.getByRole('button', { name: /^지울 문서/u })).toHaveCount(0);
  const trash = page.getByRole('region', { name: '휴지통' });
  await expect(trash).toContainText('지울 문서');
  await trash.getByRole('button', { name: '복원' }).first().click();
  await expect(documents.getByRole('button', { name: /지울 문서/u })).toBeVisible();
  // 휴지통이 비면 그 영역은 사라진다.
  await expect(trash).toHaveCount(0);
});

test('NOR-204 AC-4: 쉼표로 구분하는 칸에 여러 이름을 그대로 칠 수 있다', async ({ page }) => {
  await page.goto('/');
  const book = page.getByRole('button', { name: /인용 테스트/u });
  await expect(book).toBeVisible();
  await book.click();
  const translators = page.getByLabel('역자 (쉼표로 구분)');
  await expect(translators).toBeVisible();
  await translators.pressSequentially('옮긴이 하나, 옮긴이 둘');
  await expect(translators).toHaveValue('옮긴이 하나, 옮긴이 둘');
  const authors = page.getByLabel('저자 (쉼표로 구분)');
  await authors.fill('');
  await authors.pressSequentially('유발 하라리, 공저자');
  await expect(authors).toHaveValue('유발 하라리, 공저자');
});

test('NOR-206 AC-5: 저장하지 않은 내용도 나란히 보기에서 렌더해 보여 준다', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('새 문서 제목').fill('미리보기 확인');
  await page
    .getByRole('region', { name: 'Templates' })
    .getByRole('button', { name: /빠른 메모/u })
    .click();
  const editor = page.getByLabel('Markdown 문서');
  await expect(editor).toContainText('title: 미리보기 확인');
  await appendToEditor(page, '\n## 미리보기 제목\n\n- **굵은** 항목\n');
  await page.getByRole('button', { name: '나란히' }).click();
  const preview = page.getByRole('region', { name: '미리보기' });
  await expect(preview.getByRole('heading', { name: '미리보기 제목' })).toBeVisible();
  await expect(preview.locator('strong')).toHaveText('굵은');
  await expect(editor).toBeVisible();
});

/** 라이브 프리뷰 편집기(CodeMirror) 끝에 글자를 친다. textarea 처럼 fill 할 수 없다. */
async function appendToEditor(page: Page, text: string) {
  await page.getByLabel('Markdown 문서').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText(text);
}

test('NOR-206 AC-6·8: 라이브 편집기는 커서가 떠난 줄의 표시 문자를 숨기고 원본 그대로 저장한다', async ({
  page,
}) => {
  let saved = '';
  await page.route('**/api/documents/**', async (route) => {
    if (route.request().method() === 'PUT')
      saved = String(route.request().postDataJSON()?.source ?? '');
    await route.fallback();
  });
  await page.goto('/');
  await page.getByLabel('새 문서 제목').fill('라이브 확인');
  await page
    .getByRole('region', { name: 'Templates' })
    .getByRole('button', { name: /빠른 메모/u })
    .click();
  const editor = page.getByLabel('Markdown 문서');
  await expect(editor).toContainText('title: 라이브 확인');
  await appendToEditor(page, '\n## 라이브 제목\n\n본문 ');
  await page.keyboard.insertText('굵은말');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.getByRole('button', { name: '굵게' }).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText('\n\n끝');
  await expect(editor.locator('.cm-lp-strong')).toHaveText('굵은말');
  await expect(editor.locator('.cm-lp-h2')).toHaveText('라이브 제목');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장됨' })).toBeDisabled();
  expect(saved).toContain('## 라이브 제목\n\n본문 **굵은말**\n\n끝');
});

test('NOR-206 AC-8: 다른 문서를 연 뒤 실행 취소해도 이전 문서 내용이 돌아오지 않는다', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('새 문서 제목').fill('취소 첫 문서');
  await page
    .getByRole('region', { name: 'Templates' })
    .getByRole('button', { name: /빠른 메모/u })
    .click();
  const editor = page.getByLabel('Markdown 문서');
  await expect(editor).toContainText('title: 취소 첫 문서');
  await appendToEditor(page, '\n첫 문서에만 있는 줄');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장됨' })).toBeDisabled();

  await page.getByLabel('새 문서 제목').fill('취소 둘째 문서');
  await page
    .getByRole('region', { name: 'Templates' })
    .getByRole('button', { name: /빠른 메모/u })
    .click();
  await expect(editor).toContainText('title: 취소 둘째 문서');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(editor).toContainText('title: 취소 둘째 문서');
  await expect(editor).not.toContainText('첫 문서에만 있는 줄');
  await expect(page.getByRole('button', { name: '저장됨' })).toBeDisabled();
});

test('NOR-208 AC-6·7: 사이트 콘텐츠를 폼으로 고치고 검토한 뒤 발행한다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '사이트 콘텐츠' }).click();
  const site = page.getByRole('region', { name: '사이트 콘텐츠' });
  await site.getByRole('button', { name: 'E2E 시리즈' }).click();
  await site.getByLabel('설명').fill('고친 설명');
  await site.getByRole('button', { name: '검토' }).click();
  const diff = site.getByLabel('사이트 콘텐츠 diff');
  await expect(diff).toContainText('+  "description": "고친 설명"');
  await site.getByRole('button', { name: '발행' }).click();
  await expect(site.getByRole('status')).toContainText('발행을 맡겼습니다');

  await site.getByRole('button', { name: '새 경력' }).click();
  await site.getByLabel('파일 이름').fill('new-company');
  await site.getByLabel('회사').fill('새 회사');
  await site.getByRole('button', { name: '검토' }).click();
  await expect(site.getByRole('alert')).toContainText('role');
});

test('NOR-217 AC-3: 발행 검토 diff 를 채색해 보이고 나란히 보기로 바꾼다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '사이트 콘텐츠' }).click();
  const site = page.getByRole('region', { name: '사이트 콘텐츠' });
  await site.getByRole('button', { name: 'E2E 시리즈' }).click();
  await site.getByLabel('설명').fill('나란히 확인');
  await site.getByRole('button', { name: '검토' }).click();
  const diff = site.getByLabel('사이트 콘텐츠 diff');
  await expect(diff.locator('.diff-add')).toContainText('나란히 확인');
  await expect(diff.locator('.diff-del')).toContainText('"description": "설명"');
  await site.getByRole('button', { name: '나란히', exact: true }).click();
  await expect(diff.locator('td.diff-del').first()).toBeVisible();
  await expect(diff.locator('tr').filter({ has: page.locator('td.diff-del') })).toContainText(
    '나란히 확인',
  );
  const SP = process.env['DIFF_SHOT'];
  if (SP) await page.screenshot({ path: SP });
});

test('NOR-219 AC-1 · NOR-219 AC-5: 여러 줄 칸의 빈 줄·공백을 지키고 포트폴리오 이미지를 올린다', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '사이트 콘텐츠' }).click();
  const site = page.getByRole('region', { name: '사이트 콘텐츠' });
  await site.getByRole('button', { name: 'E2E', exact: true }).click();
  const skills = site.getByLabel('기술(한 줄에 하나)');
  await skills.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('\n\nTypeScript 와 ');
  await expect(skills).toHaveValue('C#\n\nTypeScript 와 ');

  await site.getByRole('button', { name: '새 포트폴리오' }).click();
  await site.getByRole('button', { name: '이미지 추가' }).click();
  await site.getByLabel('이미지 1 파일').setInputFiles({
    name: 'shot.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      '89504e470d0a1a0a0000000d4948445200000002000000030802000000368849d60000000b49444154789c6360c0020000150001aa6597c40000000049454e44ae426082',
      'hex',
    ),
  });
  await expect(site.getByLabel('이미지 1 경로')).toHaveValue(
    /^\/img\/portfolio\/shot-[0-9a-f]{16}\.webp$/u,
  );
  await expect(site.getByLabel('이미지 1 너비')).toHaveValue('2');
  await expect(site.getByLabel('이미지 1 높이')).toHaveValue('3');
  await expect(site.getByRole('img', { name: '이미지 1 미리보기' })).toBeVisible();
});

test('NOR-219 AC-6: 공개 초안 편집기에서 이미지를 올리면 본문에 넣고 자산으로 고른다', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('새 문서 제목').fill('이미지 글');
  await page
    .getByRole('region', { name: 'Templates' })
    .getByRole('button', { name: /공개 글 초안/u })
    .click();
  const editor = page.getByLabel('Markdown 문서');
  await expect(editor).toContainText('title: 이미지 글');
  await page.getByLabel('Markdown 문서').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.getByLabel('본문 이미지 파일').setInputFiles({
    name: 'shot.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      '89504e470d0a1a0a0000000d4948445200000002000000030802000000368849d60000000b49444154789c6360c0020000150001aa6597c40000000049454e44ae426082',
      'hex',
    ),
  });
  await expect(editor.locator('.cm-line').filter({ hasText: 'shot-' })).toContainText(
    /!\[설명\]\(shot-[0-9a-f]{16}\.webp\)/u,
  );
  await expect(page.getByRole('checkbox', { name: /shot-[0-9a-f]{16}\.webp/u })).toBeChecked();
});

test('NOR-220 AC-4: 발행한 항목은 반영 대기로 보이고 다시 검토할 수 없다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '사이트 콘텐츠' }).click();
  const site = page.getByRole('region', { name: '사이트 콘텐츠' });
  await site.getByRole('button', { name: 'E2E 시리즈' }).click();
  await site.getByLabel('설명').fill('대기 확인');
  await site.getByRole('button', { name: '검토' }).click();
  await site.getByRole('button', { name: '발행' }).click();
  await expect(site.getByRole('status')).toContainText('발행을 맡겼습니다');
  const list = site.getByRole('navigation', { name: '사이트 콘텐츠 목록' });
  await expect(list).toContainText('반영 대기');
  await list.getByRole('button', { name: /E2E 시리즈/u }).click();
  await expect(site.getByRole('button', { name: '검토' })).toBeDisabled();
  await expect(site.getByRole('button', { name: 'main 다시 읽기' })).toBeVisible();
});

test('NOR-228 AC-5: 진행 중인 발행은 새로고침 뒤에도 토스트로 이어지고 서버의 단계를 보인다', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'workbench.publishJobs',
      JSON.stringify([
        {
          ref: 'e2e-demo.json',
          title: '진행 중인 글',
          startedAt: '2026-08-12T12:00:00.000Z',
          stage: 'queued',
        },
      ]),
    ),
  );
  await page.reload();
  const toasts = page.getByRole('region', { name: '발행 진행' });
  await expect(toasts).toContainText('진행 중인 글');
  await expect(toasts).toContainText('PR #1 검사 중');
  await expect(toasts.getByRole('link', { name: 'PR #1 보기' })).toHaveAttribute(
    'href',
    'https://github.com/example/blog/pull/1',
  );
  await page.getByRole('button', { name: '사이트 콘텐츠' }).click();
  await expect(toasts).toContainText('PR #1 검사 중');
  await toasts.getByRole('button', { name: '진행 중인 글 진행 알림 닫기' }).click();
  await expect(toasts).toHaveCount(0);
});

test('NOR-229 AC-1·AC-4: 코드 블록을 편집기와 미리보기에서 강조하고 블록 메뉴로 틀을 넣는다', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('새 문서 제목').fill('코드 강조 확인');
  await page
    .getByRole('region', { name: 'Templates' })
    .getByRole('button', { name: /빠른 메모/u })
    .click();
  const editor = page.getByLabel('Markdown 문서');
  await expect(editor).toContainText('title: 코드 강조 확인');
  await appendToEditor(page, '\n```ts\nconst answer = 42;\n```\n\n');
  await expect(editor.locator('.tok-keyword').first()).toHaveText('const');

  await page.getByLabel('블록 넣기').selectOption('callout');
  await expect(editor).toContainText('{% callout type="note" title="제목" %}');
  await page.keyboard.type('알림');
  await expect(editor).toContainText('title="알림"');

  await page.getByRole('button', { name: '나란히' }).click();
  const preview = page.getByRole('region', { name: '미리보기' });
  await expect(preview.locator('pre[data-language="ts"] .tok-keyword')).toHaveText('const');
  await expect(preview.locator('aside.callout')).toContainText('알림');
});

test('NOR-240 AC-1, NOR-240 AC-2: 목록의 일지는 일일 로그로 열고 원본 편집으로 넘어간다', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Today', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^2026-08-10/u }).click();
  await expect(page.getByRole('heading', { name: '2026-08-10 일일 로그' })).toBeVisible();
  await expect(page.getByText('Daily log', { exact: true })).toBeVisible();
  await expect(page.getByTestId('day-bullets')).toContainText('손으로');

  await page.getByRole('button', { name: '원본 편집' }).click();
  await expect(page.getByLabel('Markdown 문서')).toBeVisible();
  await expect(page.getByLabel('Markdown 문서')).toContainText('2026-08-10');

  await page.getByRole('button', { name: '오늘의 로그' }).click();
  await expect(page.getByRole('heading', { name: '2026-08-12 일일 로그' })).toBeVisible();
});

test('NOR-244 AC-1, NOR-244 AC-2: 편집기는 칸을 채우고 미리보기 하위 목록은 붙어 있다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/');
  await page.getByLabel('새 문서 제목').fill('목록 모양 시험');
  await page.getByRole('button', { name: /private-post$/u }).click();
  const editor = page.getByLabel('Markdown 문서');
  await expect(editor).toBeVisible();
  const widths = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('.cm-content');
    const scroller = document.querySelector<HTMLElement>('.cm-scroller');
    return { content: content?.offsetWidth ?? 0, scroller: scroller?.clientWidth ?? 0 };
  });
  expect(widths.content).toBeGreaterThan(widths.scroller * 0.9);

  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('\n- 상위\n  - 하위 하나\n  - 하위 둘\n    - 더 하위\n- 다음 상위\n');
  await page.getByRole('button', { name: '나란히' }).click();
  const preview = page.getByRole('region', { name: '미리보기' });
  const nested = preview.locator('li > ul').first();
  await expect(nested).toBeVisible();
  const style = await nested.evaluate((element) => {
    const computed = getComputedStyle(element);
    const deeper = element.querySelector('ul');
    return {
      top: parseFloat(computed.marginTop),
      bottom: parseFloat(computed.marginBottom),
      marker: computed.listStyleType,
      deeper: deeper ? getComputedStyle(deeper).listStyleType : '',
      parent: getComputedStyle(element.parentElement?.parentElement as Element).listStyleType,
    };
  });
  expect(style.top).toBeLessThanOrEqual(4);
  expect(style.bottom).toBeLessThanOrEqual(4);
  expect(new Set([style.parent, style.marker, style.deeper]).size).toBe(3);
});

test('NOR-246 AC-1: 느슨한 목록도 미리보기에서 항목 간격이 고르다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByLabel('새 문서 제목').fill('느슨한 목록 시험');
  await page.getByRole('button', { name: /private-post$/u }).click();
  const editor = page.getByLabel('Markdown 문서');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  // 하위 목록 뒤의 빈 줄 하나가 목록 전체를 느슨한 목록으로 만든다.
  await page.keyboard.insertText('\n- 하나\n- 둘\n  - 하위 하나\n  - 하위 둘\n\n- 셋\n- 넷\n');
  await page.getByRole('button', { name: '미리보기' }).click();
  const preview = page.getByRole('region', { name: '미리보기' });
  await expect(preview.locator('li > p').first()).toBeVisible();
  const gaps = await preview
    .locator('article > ul')
    .last()
    .evaluate((list) => {
      const top = [...list.children].map((item) => item.getBoundingClientRect());
      const nested = [...(list.querySelector('ul')?.children ?? [])].map((item) =>
        item.getBoundingClientRect(),
      );
      const paragraph = getComputedStyle(list.querySelector('li > p') as Element);
      return {
        top: (top[1]?.top ?? 0) - (top[0]?.bottom ?? 0),
        nested: (nested[1]?.top ?? 0) - (nested[0]?.bottom ?? 0),
        margin: parseFloat(paragraph.marginTop) + parseFloat(paragraph.marginBottom),
      };
    });
  expect(gaps.margin).toBe(0);
  expect(Math.abs(gaps.top - gaps.nested)).toBeLessThanOrEqual(1);
});
