import { describe, expect, it } from 'vitest';

import { parseDocument, serializeDocument } from './document.js';

describe('document frontmatter', () => {
  it('canonicalizes recognized fields and preserves unknown data', () => {
    const parsed = parseDocument(`---
customField: keep-me
tags:
  - alpha
  - beta
updatedAt: 2026-08-12
kind: private-post
createdAt: 2026-08-10
title: Test
customNested:
  enabled: true
---
Body
`);

    expect(serializeDocument(parsed)).toBe(`---
title: Test
kind: private-post
createdAt: 2026-08-10
updatedAt: 2026-08-12
tags: ['alpha', 'beta']
customField: keep-me
customNested:
  enabled: true
---
Body
`);
  });

  it('rejects unsupported document kinds', () => {
    expect(() =>
      parseDocument(
        `---\ntitle: Test\nkind: nope\ncreatedAt: 2026-08-12\nupdatedAt: 2026-08-12\n---\n`,
      ),
    ).toThrow('unsupported document kind');
  });

  it('treats fields outside a kind closed set as preserved, uninterpreted data', () => {
    const source = `---
title: Capture
kind: capture
createdAt: 2026-08-12
updatedAt: 2026-08-12
tags: hand-written-value
---
Body
`;
    const document = parseDocument(source);

    expect(document.tags).toBeUndefined();
    expect(document.extra).toMatchObject({ tags: 'hand-written-value' });
    expect(serializeDocument(document)).toContain('tags: hand-written-value');
  });
});

describe('book 문서 (NOR-189)', () => {
  const base = [
    '---',
    'title: 니체의 초월자',
    'kind: book',
    'createdAt: 2026-08-19',
    'updatedAt: 2026-08-19',
    'authors:',
    '  - 프리드리히 니체',
    'status: reading',
  ];

  it('서지정보와 읽기 상태를 담고, 본문은 비공개 메모다', () => {
    const document = parseDocument(
      [
        ...base,
        'format: ebook',
        'source: library',
        'startedAt: 2026-08-06',
        'isbn13: "9788901234567"',
        'coverSource: Open Library',
        'visible: true',
        '---',
        '',
        '밑줄 친 문장과 내 생각.',
        '',
      ].join('\n'),
    );

    expect(document.kind).toBe('book');
    expect(document.authors).toEqual(['프리드리히 니체']);
    expect(document.status).toBe('reading');
    expect(document.format).toBe('ebook');
    expect(document.content.trim()).toBe('밑줄 친 문장과 내 생각.');
  });

  it('저자와 상태는 없으면 거부한다 — 조회가 실패해도 사람이 적는 값이다', () => {
    const withoutAuthors = [
      '---',
      'title: 무명',
      'kind: book',
      'createdAt: 2026-08-19',
      'updatedAt: 2026-08-19',
      'status: reading',
      '---',
      '',
    ];
    const withoutStatus = [...base.filter((line) => !line.startsWith('status:')), '---', ''];

    expect(() => parseDocument(withoutAuthors.join('\n'))).toThrow('requires authors');
    expect(() => parseDocument(withoutStatus.join('\n'))).toThrow('requires status');
  });

  it('모르는 상태·형태·별점은 받지 않는다', () => {
    expect(() =>
      parseDocument(
        [...base.filter((line) => !line.startsWith('status:')), 'status: skimmed', '---', ''].join(
          '\n',
        ),
      ),
    ).toThrow();
    expect(() => parseDocument([...base, 'rating: 6', '---', ''].join('\n'))).toThrow();
    expect(() => parseDocument([...base, 'isbn13: "89012"', '---', ''].join('\n'))).toThrow();
  });
});

describe('독서 기록 네 가지는 별개다 (NOR-189)', () => {
  const source = [
    '---',
    'title: 사피엔스',
    'kind: book',
    'createdAt: 2026-08-20',
    'updatedAt: 2026-08-20',
    "authors: ['유발 하라리']",
    'status: reading',
    'excerpts:',
    '  - page: 42',
    '    text: |-',
    '      인지혁명이 가능했던 것은',
    '      허구를 믿는 능력 때문이다',
    '    memo: 여기서 말하는 허구는 제도 전반',
    '    addedAt: 2026-08-20',
    '  - text: 페이지를 모르는 앱도 있다',
    'memos:',
    '  - page: 200',
    '    text: 3부부터 늘어진다',
    '    addedAt: 2026-08-20',
    '  - text: 옮길 문장이 없어도 남길 생각은 있다',
    '---',
    '다 읽고 나니 결국 협력의 규모에 대한 책이었다.',
    '',
  ].join('\n');

  it('구절은 저자의 말이고, 그에 딸린 메모는 그 문장에 대한 내 말이다', () => {
    const document = parseDocument(source);

    expect(document.excerpts?.[0]).toEqual({
      page: 42,
      text: '인지혁명이 가능했던 것은\n허구를 믿는 능력 때문이다',
      memo: '여기서 말하는 허구는 제도 전반',
      addedAt: '2026-08-20',
    });
  });

  it('독서 메모는 옮길 문장 없이도 남는다 — 구절에 매이지 않는다', () => {
    const document = parseDocument(source);

    expect(document.memos?.map((memo) => memo.text)).toEqual([
      '3부부터 늘어진다',
      '옮길 문장이 없어도 남길 생각은 있다',
    ]);
    // 독서 메모에는 구절이 없으므로 딸린 메모 칸도 없다.
    expect(document.memos?.[0]).not.toHaveProperty('memo');
  });

  it('독서 노트는 본문이다 — 구절에도 메모에도 섞이지 않는다', () => {
    const document = parseDocument(source);

    expect(document.content.trim()).toBe('다 읽고 나니 결국 협력의 규모에 대한 책이었다.');
  });

  it('페이지를 모르는 구절도 받는다 — 앱마다 알려 주지 않는다', () => {
    expect(parseDocument(source).excerpts?.[1]).toEqual({ text: '페이지를 모르는 앱도 있다' });
  });

  it('네 가지가 모두 원문 그대로 돌아온다', () => {
    const document = parseDocument(source);
    const round = parseDocument(serializeDocument(document));

    expect(round.excerpts).toEqual(document.excerpts);
    expect(round.memos).toEqual(document.memos);
    expect(round.content).toEqual(document.content);
  });

  it('옮긴 문장이 없는 구절은 구절이 아니다', () => {
    const empty = source.replace('  - text: 페이지를 모르는 앱도 있다', '  - page: 7');

    expect(() => parseDocument(empty)).toThrow();
  });

  it('구절에 모르는 필드를 끼워 넣지 않는다', () => {
    const stray = source.replace(
      '  - text: 페이지를 모르는 앱도 있다',
      '  - text: 문장\n    mood: 좋음',
    );

    expect(() => parseDocument(stray)).toThrow();
  });

  it('독서 메모에는 구절에 딸린 메모 칸이 없다', () => {
    const stray = source.replace(
      '  - text: 옮길 문장이 없어도 남길 생각은 있다',
      '  - text: 생각\n    memo: 여기에는 못 넣는다',
    );

    expect(() => parseDocument(stray)).toThrow();
  });
});
