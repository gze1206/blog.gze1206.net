import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { verifyBaseStyles } from './verify-base-styles.mjs';

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
