import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { collectPosts } from './draft-list.ts';

it('NOR-197 AC-1: mdx draft 를 스키마로 수집한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'draft-list-'));
  await writeFile(
    path.join(dir, 'draft.mdx'),
    `---
title: Draft
description: description
slug: draft-example
category: dev
tags: [astro]
publishedAt: 2026-11-12
updatedAt: 2026-11-12
draft: true
---
body`,
  );
  expect(await collectPosts(dir)).toEqual([
    expect.objectContaining({ slug: 'draft-example', draft: true }),
  ]);
});

it('NOR-197 AC-1: 글이 없으면 수집에 실패한다', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'draft-list-'));
  await expect(collectPosts(dir)).rejects.toThrow();
});

it('NOR-197 AC-1: 정규화 후 공개 글과 같은 draft 제목은 경고하고 제외한다', async () => {
  const module = await import('./draft-list.ts');
  expect(module).toHaveProperty('selectDraftTitles');
  const warn = vi.fn();
  expect(
    module.selectDraftTitles(
      [
        { title: 'Hello &amp; WORLD', draft: true },
        { title: 'hello & world', draft: false },
      ],
      warn,
    ),
  ).toEqual([]);
  expect(warn).toHaveBeenCalledOnce();
});
