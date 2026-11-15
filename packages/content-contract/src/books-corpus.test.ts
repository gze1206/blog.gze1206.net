import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { strictBookSchema, isBookId } from './index.ts';

it('NOR-196 AC-4: 블로그의 모든 책이 strictBookSchema 를 통과하고 파일명이 책 id 다', () => {
  const dir = fileURLToPath(new URL('../../../apps/blog/src/content/books/', import.meta.url));
  for (const name of readdirSync(dir).filter((file) => file.endsWith('.json'))) {
    const data = JSON.parse(readFileSync(`${dir}${name}`, 'utf8'));
    expect(strictBookSchema.safeParse(data).success).toBe(true);
    expect(isBookId(name.slice(0, -5))).toBe(true);
    expect(name.slice(0, -5)).toBe(data.isbn13 ?? data.title.trim().replace(/\s+/g, '-'));
  }
});
