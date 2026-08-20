import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { verifyBaseStyles, verifyReadingColumn } from './verify-base-styles.mjs';

it('전역 스타일이 모두 살아 있다', async () => {
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');

  expect(verifyBaseStyles(css)).toEqual([]);
});

it('건너뛰기 링크가 사라지거나 화면에 남으면 잡아낸다', () => {
  expect(verifyBaseStyles('')).toContain(
    'skip link style is missing — it would render on every page',
  );
  expect(verifyBaseStyles('.skip-link { position: fixed; }')).toContain(
    'skip link must stay off-screen until focused',
  );
});

it('글 상세가 한 열을 쓴다', async () => {
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');

  expect(verifyReadingColumn(css)).toEqual([]);
});

it('코드를 본문 열 밖으로 밀어내면 잡아낸다', () => {
  // 실제로 이랬다: `4vw` 라 820px 화면에서 코드가 17px 씩 화면 밖으로 나갔다.
  expect(
    verifyReadingColumn('.post-body { --code-bleed: clamp(0.75rem, 4vw, 2.5rem); }'),
  ).toContain('code blocks must not be widened out of the reading column');
});

it('두 번째 넓은 열이 다시 생기면 잡아낸다', () => {
  expect(verifyReadingColumn(':root { --spacing-reading-wide: 61.25rem; }')).toContain(
    'the article must not have a second, wider column',
  );
});
