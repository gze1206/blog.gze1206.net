import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BLOG_LAYOUT } from './index.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('BLOG_LAYOUT', () => {
  it('NOR-195 AC-7: 경로가 실제 블로그 디렉터리를 가리킨다', () => {
    expect(existsSync(`${repoRoot}${BLOG_LAYOUT.postsDir}`)).toBe(true);
    expect(existsSync(`${repoRoot}${BLOG_LAYOUT.publicDir}`)).toBe(true);
  });
});

it('NOR-196 AC-3: booksDir·bookCoversDir 가 실제 디렉터리를 가리킨다', () => {
  expect(existsSync(`${repoRoot}${BLOG_LAYOUT.booksDir}`)).toBe(true);
  expect(existsSync(`${repoRoot}${BLOG_LAYOUT.bookCoversDir}`)).toBe(true);
});
