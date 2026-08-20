import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { verifyBaseStyles, verifyCodeBleed } from './verify-base-styles.mjs';

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

it('코드 블록이 화면 밖으로 나가지 않는다', async () => {
  const css = await readFile(new URL('../src/styles/global.css', import.meta.url), 'utf8');

  expect(verifyCodeBleed(css)).toEqual([]);
});

it('화면 크기에 비례하는 넓힘값을 잡아낸다', () => {
  // 실제로 이랬다: 화면이 400~980px 일 때 글의 좌우 여백보다 커져 코드가 잘려 나갔다.
  expect(verifyCodeBleed('.post-body { --code-bleed: clamp(0.75rem, 4vw, 2.5rem); }')).toEqual([
    'code bleed must start at 0 — narrow screens have no room to widen into',
    'code bleed must not scale with the viewport: clamp(0.75rem, 4vw, 2.5rem)',
  ]);
});

it('넓힘값이 아예 없으면 잡아낸다', () => {
  expect(verifyCodeBleed('')).toEqual(['code bleed variable is missing']);
});
