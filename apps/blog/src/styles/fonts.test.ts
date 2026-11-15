import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

it('NOR-202 AC-1: 고정폭 스택은 generic monospace 앞에 한글 산세리프 대체를 둔다', async () => {
  const css = await readFile(new URL('./global.css', import.meta.url), 'utf8');
  const stack = /--font-mono:([^;]+);/u.exec(css)?.[1] ?? '';
  const families = stack.split(',').map((family) => family.trim().replace(/^['"]|['"]$/gu, ''));
  const generic = families.indexOf('monospace');
  expect(generic).toBe(families.length - 1);
  expect(families.indexOf('Pretendard Variable')).toBeGreaterThan(-1);
  expect(families.indexOf('Pretendard Variable')).toBeLessThan(generic);
  expect(families.indexOf('Malgun Gothic')).toBeGreaterThan(-1);
  expect(families.indexOf('Malgun Gothic')).toBeLessThan(generic);
});

it('NOR-203 AC-2: 블로그 스타일은 공유 토큰을 가져다 쓰고 --theme 값을 다시 정의하지 않는다', async () => {
  const css = await readFile(new URL('./global.css', import.meta.url), 'utf8');
  expect(css).toContain("@import '@gze1206/theme/tokens.css'");
  expect(css).not.toMatch(/--theme-[a-z-]+:\s*#/u);
});
