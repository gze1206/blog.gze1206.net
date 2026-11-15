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

it('NOR-224 AC-1: 블로그 스타일은 세리프 서체를 쓰지 않는다', async () => {
  const css = await readFile(new URL('./global.css', import.meta.url), 'utf8');
  expect(css).not.toContain('--font-serif');
  expect(css).not.toMatch(/font-family:[^;]*\bserif\b(?<!sans-serif)/u);
});

it('NOR-224 AC-2: 명조 웹폰트를 가져오지도, 의존성으로 두지도 않는다', async () => {
  const layout = await readFile(new URL('../layouts/BaseLayout.astro', import.meta.url), 'utf8');
  const pkg = await readFile(new URL('../../package.json', import.meta.url), 'utf8');
  expect(layout).not.toContain('noto-serif-kr');
  expect(pkg).not.toContain('noto-serif-kr');
});

it('NOR-224 AC-3: 음수 자간은 -0.03em 보다 좁히지 않는다', async () => {
  const css = await readFile(new URL('./global.css', import.meta.url), 'utf8');
  const tight = [...css.matchAll(/letter-spacing:\s*(-[\d.]+)em/gu)]
    .map((match) => Number(match[1]))
    .filter((value) => value < -0.03);
  expect(tight).toEqual([]);
});
