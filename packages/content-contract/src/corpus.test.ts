import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { BLOG_LAYOUT, strictPostSchema } from './index.js';

const postsDir = fileURLToPath(new URL(`../../../${BLOG_LAYOUT.postsDir}/`, import.meta.url));
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/u;

describe('블로그 글 전수', () => {
  it('NOR-195 AC-9: 모든 글 frontmatter 가 strict 계약을 통과한다', () => {
    const files = readdirSync(postsDir).filter((name) => /\.(?:md|mdx|mdoc)$/u.test(name));
    expect(files.length).toBeGreaterThan(0);
    const failures = files.flatMap((name) => {
      const match = FRONTMATTER.exec(readFileSync(`${postsDir}${name}`, 'utf8'));
      const result = strictPostSchema.safeParse(parse(match?.[1] ?? ''));
      return result.success ? [] : [`${name}: ${result.error.message}`];
    });
    expect(failures).toEqual([]);
  });
});
