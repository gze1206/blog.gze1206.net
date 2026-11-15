import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const RAW =
  /\b(?:bg|text|border|ring|divide|outline|fill|stroke|placeholder|from|to)-(?:white|black|stone|emerald|amber|red|rose|sky|green|yellow|zinc|neutral|slate|gray)(?:-\d{2,3})?\b|\[#[0-9a-f]{3,8}\]|#[0-9a-f]{6}\b/giu;

it('NOR-203 AC-4: 화면 코드는 원색 팔레트 유틸리티와 16진수 색을 쓰지 않는다', () => {
  const files = readdirSync(ROOT, { recursive: true, encoding: 'utf8' }).filter(
    (name) =>
      /\.(tsx|ts|css)$/u.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx'),
  );
  expect(files.length).toBeGreaterThan(0);
  const found = files.flatMap((name) =>
    [...readFileSync(join(ROOT, name), 'utf8').matchAll(RAW)].map(
      (match) => `${name}: ${match[0]}`,
    ),
  );
  expect(found).toEqual([]);
});

it('NOR-203 AC-2: 워크벤치 스타일은 공유 토큰을 가져다 쓰고 --theme 값을 다시 정의하지 않는다', () => {
  const css = readFileSync(join(ROOT, 'styles.css'), 'utf8');
  expect(css).toContain("@import '@gze1206/theme/tokens.css'");
  expect(css).not.toMatch(/--theme-[a-z-]+:\s*#/u);
});
