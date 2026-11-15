import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { PublicBlogPublisher } from '../adapters/publicBlog.js';
import { ServerFileStore } from '../adapters/fileStore.js';
import { createApp } from '../app.js';

const calls: unknown[] = [];
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
  async listSite() {
    return {
      commit: 'a'.repeat(40),
      entries: [
        { collection: 'series', id: 'a', data: { name: 'n', slug: 'a', description: 'd' } },
      ],
      problems: [],
    };
  },
  async reviewSite(change: unknown) {
    calls.push(change);
    return {
      reviewId: 'r'.repeat(43),
      baseHead: 'a'.repeat(40),
      branch: 'content/site-series-a',
      targetPath: 'apps/blog/src/content/series/a.json',
      diff: 'diff',
      kind: 'write',
    };
  },
  async publishSite(change: unknown, confirm: unknown) {
    calls.push({ change, confirm });
    return {
      outboxRef: 'site-series-a.json',
      exportRef: 'site-series-a.bundle',
      exportFormat: 'bundle',
      baseSha: 'a'.repeat(40),
      branch: 'content/site-series-a',
      commit: 'b'.repeat(40),
      targetPath: 'apps/blog/src/content/series/a.json',
    };
  },
} as unknown as PublicBlogPublisher;

async function app() {
  const root = await mkdtemp(path.join(tmpdir(), 'site-api-'));
  return createApp(new ServerFileStore(root), publisher);
}

const post = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('/api/site', () => {
  it('NOR-208 AC-3: 사이트 콘텐츠 목록을 돌려준다', async () => {
    const response = await (await app()).request('/api/site');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { entries: unknown[] };
    expect(body.entries).toHaveLength(1);
  });

  it('NOR-208 AC-4: 스키마에 맞지 않는 입력은 필드별 오류로 400 을 돌려준다', async () => {
    calls.length = 0;
    const response = await (
      await app()
    ).request(
      '/api/site/review',
      post({ collection: 'series', id: 'a', data: { name: 'n', slug: 'a' } }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; issues: { path: string }[] } };
    expect(body.error.code).toBe('invalid_content');
    expect(body.error.issues.map((issue) => issue.path)).toContain('description');
    expect(calls).toEqual([]);
    const badId = await (
      await app()
    ).request(
      '/api/site/review',
      post({ collection: 'series', id: '../x', data: { name: 'n', slug: 'a', description: 'd' } }),
    );
    expect(badId.status).toBe(400);
  });

  it('NOR-208 AC-5: 확정은 confirmPublish: true 와 검토 id 가 있어야 한다', async () => {
    calls.length = 0;
    const change = {
      collection: 'series',
      id: 'a',
      data: { name: 'n', slug: 'a', description: 'd' },
    };
    const review = await (await app()).request('/api/site/review', post(change));
    expect(review.status).toBe(200);
    const rejected = await (
      await app()
    ).request(
      '/api/site/confirm',
      post({ ...change, confirmPublish: false, reviewId: 'r'.repeat(43) }),
    );
    expect(rejected.status).toBe(400);
    const confirmed = await (
      await app()
    ).request(
      '/api/site/confirm',
      post({ ...change, confirmPublish: true, reviewId: 'r'.repeat(43) }),
    );
    expect(confirmed.status).toBe(201);
    expect(calls).toHaveLength(2);
  });
});
