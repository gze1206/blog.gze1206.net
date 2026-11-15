import { describe, expect, it } from 'vitest';

const CURRENT = `---
title: '백준 15663 : N과 M (9) - Ruby'
description: 'Ruby 풀이'
slug: baekjoon
category: Programming
tags:
  - Ruby
  - 백준
publishedAt: 2021-10-28T14:20:23.833Z
updatedAt: 2021-10-28T14:20:23.833Z
draft: false
---

본문 첫 줄
`;

// 워크벤치가 다시 직렬화한 같은 글. 표기만 다르다.
const SAME = `---
title: "백준 15663 : N과 M (9) - Ruby"
description: Ruby 풀이
slug: baekjoon
category: Programming
tags: ['Ruby', '백준']
publishedAt: 2021-10-28T14:20:23.833Z
updatedAt: 2021-10-28T14:20:23.833Z
draft: false
---
본문 첫 줄
`;

async function preserve() {
  const mod = await import('./preserve.js');
  expect(mod).toHaveProperty('preservePublishedFormat');
  return mod.preservePublishedFormat;
}

describe('발행 표기 보존', () => {
  it('NOR-209 AC-2: 내용이 같으면 블로그의 파일을 그대로 돌려준다', async () => {
    const run = await preserve();
    expect(run(CURRENT, SAME)).toBe(CURRENT);
  });

  it('NOR-209 AC-2: 바뀐 필드만 고치고(따옴표 형식은 원래 것을 잇는다) 나머지 표기와 본문 앞 빈 줄은 남긴다', async () => {
    const run = await preserve();
    const next = SAME.replace('description: Ruby 풀이', 'description: 새 설명').replace(
      '본문 첫 줄',
      '본문 고친 줄',
    );
    expect(run(CURRENT, next)).toBe(
      CURRENT.replace("description: 'Ruby 풀이'", "description: '새 설명'").replace(
        '본문 첫 줄',
        '본문 고친 줄',
      ),
    );
  });

  it('NOR-209 AC-2: 없어진 필드는 지우고 새 필드는 더한다', async () => {
    const run = await preserve();
    const next = SAME.replace('draft: false\n', 'toc: floating\n');
    const result = run(CURRENT, next);
    expect(result).not.toContain('draft:');
    expect(result).toContain('toc: floating');
    expect(result).toContain("title: '백준 15663 : N과 M (9) - Ruby'");
  });

  it('NOR-209 AC-2: 블로그에 없는 글은 새로 만든 그대로 쓴다', async () => {
    const run = await preserve();
    expect(run(null, SAME)).toBe(SAME);
  });
});

describe('발행 표기 보존 검수 반영', () => {
  it('NOR-209 AC-5: anchor·alias 를 공유한 필드도 의도한 값 그대로 나온다', async () => {
    const run = await preserve();
    const { parse } = await import('yaml');
    const current = '---\ntitle: &t 옛 제목\ndescription: *t\nslug: a\n---\n본문\n';
    const next = '---\ntitle: 새 제목\ndescription: 옛 제목\nslug: a\n---\n본문\n';
    const result = run(current, next);
    const yaml = /^---\n([\s\S]*?)\n---\n/u.exec(result)?.[1] ?? '';
    expect(parse(yaml)).toEqual({ title: '새 제목', description: '옛 제목', slug: 'a' });
  });

  it('NOR-209 AC-5: 상속 속성 이름의 키도 의도에 없으면 지운다', async () => {
    const run = await preserve();
    const current = '---\ntitle: 글\nconstructor: 비밀\ntoString: 메모\n---\n본문\n';
    const next = '---\ntitle: 글\n---\n본문\n';
    const result = run(current, next);
    expect(result).not.toContain('constructor');
    expect(result).not.toContain('toString');
  });
});
