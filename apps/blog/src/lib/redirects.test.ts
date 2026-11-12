import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('NOR-197 AC-6: career 는 _redirects 에서 about 으로 301 이동한다', () => {
  const path = 'public/_redirects';
  expect(existsSync(path)).toBe(true);
  expect(readFileSync(path, 'utf8').trim().split(/\s+/)).toEqual(['/career', '/about', '301']);
});
