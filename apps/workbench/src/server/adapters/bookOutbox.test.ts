import { expect, it } from 'vitest';
import { BLOG_LAYOUT } from '@gze1206/content-contract';
import * as outbox from './publishOutbox.js';

it('NOR-196 AC-14: outbox 는 글·책 경로만 받는다', () => {
  expect(outbox).toHaveProperty('targetKeyFromPath');
  const target = Reflect.get(outbox, 'targetKeyFromPath');
  expect(target(`${BLOG_LAYOUT.postsDir}/hello.mdoc`)).toBe('post:hello');
  expect(target(`${BLOG_LAYOUT.booksDir}/책.json`)).toBe('book:책');
  expect(() => target(`${BLOG_LAYOUT.booksDir}/../x.json`)).toThrow('invalid publish target path');
});
