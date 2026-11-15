import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import type { PublicBlogPublisher } from '../adapters/publicBlog.js';
import { ServerFileStore } from '../adapters/fileStore.js';
import { createApp } from '../app.js';
import { encodeDocumentId } from '../documentIds.js';

const publicDraft = `---
title: 공개
kind: public-draft
createdAt: 2026-08-10
updatedAt: 2026-08-12
publicEligible: true
description: 설명
slug: open
category: engineering
tags: ['a']
publishedAt: 2026-08-12
---
본문
`;
const privatePost = `---
title: 비공개
kind: private-post
createdAt: 2026-08-10
updatedAt: 2026-08-12
---
비밀
`;

it('NOR-209 AC-3: 공개 초안만 발행자에게 넘겨 상태를 받는다', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'status-api-'));
  await mkdir(path.join(root, 'drafts'), { recursive: true });
  await writeFile(path.join(root, 'drafts/open.md'), publicDraft);
  await writeFile(path.join(root, 'drafts/secret.md'), privatePost);
  const seen: unknown[] = [];
  const publisher = {
    async listAssets() {
      return [];
    },
    async review() {
      throw new Error('unused');
    },
    async publish() {
      throw new Error('unused');
    },
    async publishStatus(drafts: unknown) {
      seen.push(drafts);
      return { documents: [], blogOnly: [] };
    },
  } as unknown as PublicBlogPublisher;
  const response = await createApp(new ServerFileStore(root), publisher).request(
    '/api/publish/status',
  );
  expect(response.status).toBe(200);
  expect(seen).toEqual([[{ documentId: encodeDocumentId('drafts/open.md'), source: publicDraft }]]);
});
