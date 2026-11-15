import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { strictBookSchema, isBookId } from './index.ts';

it('NOR-196 AC-4: 블로그의 모든 책이 strictBookSchema 를 통과하고 파일명이 책 id 다', () => {
  const dir = fileURLToPath(new URL('../../../apps/blog/src/content/books/', import.meta.url));
  for (const name of readdirSync(dir).filter((file) => file.endsWith('.json'))) {
    const data = JSON.parse(readFileSync(`${dir}${name}`, 'utf8'));
    expect(strictBookSchema.safeParse(data).success).toBe(true);
    // 책 id 는 작업 공간의 파일 이름이다(NOR-212). 등록 뒤 ISBN·제목을 고쳐도 바뀌지 않으므로
    // 내용에서 다시 계산한 값과 같을 필요는 없다.
    expect(isBookId(name.slice(0, -5))).toBe(true);
  }
});
