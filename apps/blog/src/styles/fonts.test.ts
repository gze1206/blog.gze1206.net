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
