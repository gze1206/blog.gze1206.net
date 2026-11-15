import { expect, it } from 'vitest';

import { formatPrettierJson } from './prettierJson.js';

it('NOR-208 AC-9: 이모지는 두 칸으로 센다', () => {
  // 들여쓰기 2 + "a": 5 + [ 1 + 따옴표 2 + 이모지 46칸 + ] 1 = 57 → 이모지를 한 칸으로 세면 한 줄, 두 칸이면 103칸
  const value = { a: ['😀'.repeat(46)] };
  expect(formatPrettierJson(value)).toBe(`{\n  "a": [\n    "${'😀'.repeat(46)}"\n  ]\n}\n`);
});

it('NOR-208 AC-9: 마지막 요소에는 쉼표 칸을 세지 않는다(정확히 100칸이면 한 줄)', () => {
  // `  "a": ["` 9칸 + x 89칸 + `"]` 2칸 = 100칸
  const value = { a: ['x'.repeat(89)] };
  expect(formatPrettierJson(value)).toBe(`{\n  "a": ["${'x'.repeat(89)}"]\n}\n`);
});
