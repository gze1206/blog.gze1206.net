import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { PublicBlogPublisher } from '../adapters/publicBlog.js';
import { ServerFileStore } from '../adapters/fileStore.js';
import { createApp } from '../app.js';
import { encodeDocumentId } from '../documentIds.js';

const draft = `---
title: API review
kind: public-draft
createdAt: 2026-08-10
updatedAt: 2026-08-12
publicEligible: true
description: Review endpoint
slug: api-review
category: engineering
tags: ['api']
publishedAt: 2026-08-12
---
# API review
`;

describe('/api/publish', () => {
  it('returns only the outbox export contract after literal confirmation', async () => {
    const fixture = await createFixture();
    const id = encodeDocumentId('drafts/api-review.md');
    const review = await fixture.app.request('/api/publish/review', json({ id, assetIds: [] }));
    const reviewBody = (await review.json()) as { reviewId: string };

    const confirmed = await fixture.app.request(
      '/api/publish/confirm',
      json({ id, assetIds: [], confirmPublish: true, reviewId: reviewBody.reviewId }),
    );

    expect(confirmed.status).toBe(201);
    await expect(confirmed.json()).resolves.toEqual({
      outboxRef: 'api-review-20260813T000000Z.json',
      exportRef: 'api-review-20260813T000000Z.bundle',
      exportFormat: 'bundle',
      baseSha: 'a'.repeat(40),
      branch: 'content/api-review',
      commit: 'b'.repeat(40),
      targetPath: 'src/content/posts/api-review.mdoc',
    });
  });

  it('requires a base64url opaque review id and literal confirmation', async () => {
    const fixture = await createFixture();
    const id = encodeDocumentId('drafts/api-review.md');
    const response = await fixture.app.request(
      '/api/publish/confirm',
      json({ id, assetIds: [], confirmPublish: false, reviewId: 'a'.repeat(43) }),
    );
    expect(response.status).toBe(400);
    const invalidId = await fixture.app.request(
      '/api/publish/confirm',
      json({ id, assetIds: [], confirmPublish: true, reviewId: 'not-an-opaque-id' }),
    );
    expect(invalidId.status).toBe(400);
  });
});

async function createFixture() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'publish-api-private-'));
  await mkdir(path.join(workspaceRoot, 'drafts'), { recursive: true });
  await writeFile(path.join(workspaceRoot, 'drafts/api-review.md'), draft);
  return {
    app: createApp(new ServerFileStore(workspaceRoot), publisher),
  };
}

const publisher: PublicBlogPublisher = {
  async listAssets() {
    return [];
  },
  async review() {
    return {
      reviewId: 'a'.repeat(43),
      baseHead: 'a'.repeat(40),
      branch: 'content/api-review',
      targetPath: 'src/content/posts/api-review.mdoc',
      metadata: {
        title: 'API review',
        description: 'Review endpoint',
        slug: 'api-review',
        category: 'engineering',
        tags: ['api'],
        publishedAt: '2026-08-12',
        updatedAt: '2026-08-12',
        draft: false,
      },
      assets: [],
      diff: 'diff',
    };
  },
  async publish() {
    return {
      outboxRef: 'api-review-20260813T000000Z.json',
      exportRef: 'api-review-20260813T000000Z.bundle',
      exportFormat: 'bundle',
      baseSha: 'a'.repeat(40),
      branch: 'content/api-review',
      commit: 'b'.repeat(40),
      targetPath: 'src/content/posts/api-review.mdoc',
    };
  },
};

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
