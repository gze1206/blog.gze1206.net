import { describe, expect, it } from 'vitest';

const DIFF = `--- a/post.mdoc
+++ b/post.mdoc
@@ -1,4 +1,4 @@
 ---
-title: 옛 제목
-tags: [a]
+title: 새 제목
 slug: post
@@ -10,2 +10,3 @@
 본문
+더한 줄
+또 더한 줄
표지 추가/교체: assets/books/a.png`;

async function rows() {
  const mod = await import('./diffRows.js');
  expect(mod).toHaveProperty('parseUnifiedDiff');
  return mod;
}

describe('diff 해석', () => {
  it('NOR-217 AC-1: 줄마다 종류와 전·후 줄 번호를 돌려준다', async () => {
    const { parseUnifiedDiff } = await rows();
    const parsed = parseUnifiedDiff(DIFF);
    expect(parsed.map((row) => row.kind)).toEqual([
      'file',
      'file',
      'hunk',
      'context',
      'del',
      'del',
      'add',
      'context',
      'hunk',
      'context',
      'add',
      'add',
      'note',
    ]);
    expect(parsed[3]).toMatchObject({ text: '---', oldLine: 1, newLine: 1 });
    expect(parsed[5]).toMatchObject({ text: 'tags: [a]', oldLine: 3, newLine: null });
    expect(parsed[6]).toMatchObject({ text: 'title: 새 제목', oldLine: null, newLine: 2 });
    expect(parsed[7]).toMatchObject({ text: 'slug: post', oldLine: 4, newLine: 3 });
    expect(parsed[11]).toMatchObject({ kind: 'add', newLine: 12 });
    expect(parsed[12]).toMatchObject({ kind: 'note', text: '표지 추가/교체: assets/books/a.png' });
  });

  it('NOR-217 AC-2: 지운 줄과 더한 줄을 짝짓고 모자라면 빈칸으로 채운다', async () => {
    const { parseUnifiedDiff, toSideBySide } = await rows();
    const pairs = toSideBySide(parseUnifiedDiff(DIFF));
    const body = pairs.filter((pair) => pair.kind === 'pair');
    expect(body.map((pair) => [pair.left?.text ?? null, pair.right?.text ?? null])).toEqual([
      ['---', '---'],
      ['title: 옛 제목', 'title: 새 제목'],
      ['tags: [a]', null],
      ['slug: post', 'slug: post'],
      ['본문', '본문'],
      [null, '더한 줄'],
      [null, '또 더한 줄'],
    ]);
  });
});
