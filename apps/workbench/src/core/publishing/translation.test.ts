import { describe, expect, it } from 'vitest';

import { parseDocument } from '../document/document.js';

const korean = `---
title: 개발기 1편
kind: public-draft
createdAt: 2026-11-20
updatedAt: 2026-11-21
publicEligible: true
description: 첫 편
slug: devlog-1
category: 개발기
tags: ['unity']
series: project-arcana-devlog
seriesOrder: 1
publishedAt: 2026-11-21
---
# 본문

![그림](images/a.png)
`;

async function plan() {
  const mod = await import('./translation.js');
  expect(mod).toHaveProperty('planTranslationDraft');
  return mod.planTranslationDraft;
}

describe('NOR-252 영어판 만들기', () => {
  it('NOR-252 AC-3: 한국어 공개 초안에서 영어 초안과 원본에 넣을 키를 만든다', async () => {
    const result = (await plan())(korean, '2026-11-26');
    expect(result.relativePath).toBe('drafts/devlog-1.en.md');
    const english = parseDocument(result.source);
    expect(english).toMatchObject({
      kind: 'public-draft',
      title: '[EN] 개발기 1편',
      publicEligible: true,
      slug: 'devlog-1',
      lang: 'en',
      translationKey: 'devlog-1',
      draft: true,
      series: 'project-arcana-devlog',
      seriesOrder: 1,
      createdAt: '2026-11-26',
    });
    expect(english.content).toContain('![그림](images/a.png)');
    expect(result.originalSource).not.toBeNull();
    expect(parseDocument(result.originalSource ?? '')).toMatchObject({
      translationKey: 'devlog-1',
    });
    expect(parseDocument(result.originalSource ?? '').lang).toBeUndefined();
  });

  it('NOR-254 AC-3: 원본 키가 slug 와 같으면 원본을 고치지 않고, 다르면 slug 로 고친다', async () => {
    const make = await plan();
    const same = korean.replace(
      'publishedAt: 2026-11-21\n',
      'publishedAt: 2026-11-21\ntranslationKey: devlog-1\n',
    );
    expect(make(same, '2026-11-26').originalSource).toBeNull();
    const other = korean.replace(
      'publishedAt: 2026-11-21\n',
      'publishedAt: 2026-11-21\ntranslationKey: arcana-1\n',
    );
    const result = make(other, '2026-11-26');
    expect(parseDocument(result.source).translationKey).toBe('devlog-1');
    expect(parseDocument(result.originalSource ?? '').translationKey).toBe('devlog-1');
  });

  it('NOR-252 AC-3: 공개 초안이 아니거나 이미 영어면 거절한다', async () => {
    const make = await plan();
    expect(() =>
      make(
        korean
          .replace('kind: public-draft', 'kind: private-post')
          .replace('publicEligible: true\n', ''),
        '2026-11-26',
      ),
    ).toThrow();
    expect(() =>
      make(
        korean.replace('publishedAt: 2026-11-21\n', 'publishedAt: 2026-11-21\nlang: en\n'),
        '2026-11-26',
      ),
    ).toThrow();
  });
});
