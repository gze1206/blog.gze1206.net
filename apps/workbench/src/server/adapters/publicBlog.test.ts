import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';
import { BLOG_LAYOUT } from '@gze1206/content-contract';

import { PublicBlogAdapter } from './publicBlog.js';
import { startHttpsGitServer } from '../../../test/fixtures/httpsGitServer.js';
import { LoopbackTestRemotePolicy } from '../../../test/fixtures/loopbackRemotePolicy.js';

const run = promisify(execFile);
const documentId = 'A'.repeat(43);
const draft = `---
title: Publish safely
kind: public-draft
createdAt: 2026-08-10
updatedAt: 2026-08-12
publicEligible: true
description: Review before commit
slug: safe-publish
category: engineering
tags: ['git']
publishedAt: 2026-08-12
---
# Publish safely

![diagram](images/flow.png)
`;

describe('PublicBlogAdapter', () => {
  it('NOR-195 AC-7: 발행 경로가 블로그 레이아웃을 따른다', async () => {
    const fixture = await createFixture();
    try {
      const adapter = fixture.adapter();
      const asset = await onlyAsset(adapter);
      const review = await adapter.review({ documentId, source: draft, assetIds: [asset.id] });
      const result = await adapter.publish({
        documentId,
        source: draft,
        assetIds: [asset.id],
        confirmPublish: true,
        reviewId: review.reviewId,
      });

      expect(review.reviewId).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      expect(result).toMatchObject({
        branch: 'content/safe-publish',
        targetPath: `${BLOG_LAYOUT.postsDir}/safe-publish.mdoc`,
        baseSha: review.baseHead,
        exportFormat: 'bundle',
        exportRef: expect.stringMatching(/^safe-publish-.*\.bundle$/u),
        outboxRef: expect.stringMatching(/^safe-publish-.*\.json$/u),
      });
      expect(JSON.stringify(result)).not.toContain(fixture.server.remote);
      expect(JSON.stringify(result)).not.toContain(fixture.workBase);
      expect(JSON.stringify(result)).not.toContain(fixture.outboxRoot);
      await expect(git(fixture.sourceRoot, 'rev-list', '--count', 'main')).resolves.toBe('1');

      const consumer = await cloneConsumer(fixture);
      const bundle = path.join(fixture.outboxRoot, result.exportRef);
      await git(consumer, 'bundle', 'verify', bundle);
      await git(consumer, 'fetch', bundle, 'content/safe-publish:content/safe-publish');
      await git(consumer, 'switch', 'content/safe-publish');
      await expect(
        readFile(path.join(consumer, BLOG_LAYOUT.postsDir, 'safe-publish.mdoc'), 'utf8'),
      ).resolves.toContain('![diagram](/assets/posts/safe-publish/images/flow.png)');
      await expect(
        readFile(
          path.join(consumer, BLOG_LAYOUT.publicDir, 'assets/posts/safe-publish/images/flow.png'),
          'utf8',
        ),
      ).resolves.toBe('approved-image');
      await expect(git(consumer, 'log', '-1', '--format=%an <%ae>|%cn <%ce>')).resolves.toBe(
        'Publish Bot <publish@example.test>|Publish Bot <publish@example.test>',
      );
      await expect(readdir(fixture.workBase)).resolves.toEqual([]);
    } finally {
      await fixture.close();
    }
  });

  it('falls back to format-patch and produces an applyable artifact', async () => {
    const fixture = await createFixture();
    try {
      const adapter = fixture.adapter('format-patch');
      const asset = await onlyAsset(adapter);
      const review = await adapter.review({ documentId, source: draft, assetIds: [asset.id] });
      const result = await adapter.publish({
        documentId,
        source: draft,
        assetIds: [asset.id],
        confirmPublish: true,
        reviewId: review.reviewId,
      });

      expect(result).toMatchObject({
        exportFormat: 'format-patch',
        exportRef: expect.stringMatching(/^safe-publish-.*\.patch$/u),
      });
      const consumer = await cloneConsumer(fixture);
      await git(consumer, 'switch', '-c', 'content/safe-publish', result.baseSha);
      await git(consumer, 'am', path.join(fixture.outboxRoot, result.exportRef));
      await expect(
        readFile(path.join(consumer, BLOG_LAYOUT.postsDir, 'safe-publish.mdoc'), 'utf8'),
      ).resolves.toContain('slug: safe-publish');
    } finally {
      await fixture.close();
    }
  });

  it('rejects a changed draft as stale and removes its review clone', async () => {
    const fixture = await createFixture();
    try {
      const adapter = fixture.adapter();
      const asset = await onlyAsset(adapter);
      const review = await adapter.review({ documentId, source: draft, assetIds: [asset.id] });

      await expect(
        adapter.publish({
          documentId,
          source: draft.replace('# Publish safely', '# Changed'),
          assetIds: [asset.id],
          confirmPublish: true,
          reviewId: review.reviewId,
        }),
      ).rejects.toThrow(/stale/u);
      await expect(readdir(fixture.workBase)).resolves.toEqual([]);
      await expect(readdir(fixture.outboxRoot)).resolves.toEqual([]);
    } finally {
      await fixture.close();
    }
  });

  it('removes a review clone when confirm-time draft validation fails', async () => {
    const fixture = await createFixture();
    try {
      const adapter = fixture.adapter();
      const asset = await onlyAsset(adapter);
      const review = await adapter.review({ documentId, source: draft, assetIds: [asset.id] });

      await expect(
        adapter.publish({
          documentId,
          source: `${draft}\n![unapproved](images/not-approved.png)\n`,
          assetIds: [asset.id],
          confirmPublish: true,
          reviewId: review.reviewId,
        }),
      ).rejects.toThrow(/unresolved asset reference/u);
      await expect(readdir(fixture.workBase)).resolves.toEqual([]);
      await expect(readdir(fixture.outboxRoot)).resolves.toEqual([]);
    } finally {
      await fixture.close();
    }
  });

  it('does not create a commit or outbox artifact without explicit author identity', async () => {
    const fixture = await createFixture();
    try {
      const adapter = fixture.adapter(undefined, { name: '', email: '' });
      const asset = await onlyAsset(adapter);
      const review = await adapter.review({ documentId, source: draft, assetIds: [asset.id] });
      await expect(
        adapter.publish({
          documentId,
          source: draft,
          assetIds: [asset.id],
          confirmPublish: true,
          reviewId: review.reviewId,
        }),
      ).rejects.toThrow(/identity/u);
      await expect(readdir(fixture.outboxRoot)).resolves.toEqual([]);
      await expect(readdir(fixture.workBase)).resolves.toEqual([]);
    } finally {
      await fixture.close();
    }
  });
});

async function createFixture(seedPosts: Readonly<Record<string, string>> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'ephemeral-public-blog-'));
  const sourceRoot = path.join(root, 'source');
  const privateRoot = path.join(root, 'workspace');
  const workBase = path.join(root, 'work');
  const outboxRoot = path.join(root, 'outbox');
  await mkdir(path.join(sourceRoot, BLOG_LAYOUT.postsDir), { recursive: true });
  await mkdir(path.join(privateRoot, 'assets/public', documentId, 'images'), { recursive: true });
  await mkdir(workBase);
  await mkdir(outboxRoot);
  await writeFile(path.join(sourceRoot, 'README.md'), 'public blog\n');
  await writeFile(
    path.join(privateRoot, 'assets/public', documentId, 'images/flow.png'),
    'approved-image',
  );
  await git(sourceRoot, 'init', '-b', 'main');
  await git(sourceRoot, 'config', 'user.name', 'Fixture');
  await git(sourceRoot, 'config', 'user.email', 'fixture@example.test');
  await git(sourceRoot, 'add', 'README.md');
  await git(sourceRoot, 'commit', '-m', 'initial');
  // 서버는 시작 시점의 bare clone 을 제공한다. 심을 파일은 그 전에 커밋해야 보인다.
  for (const [relativePath, contents] of Object.entries(seedPosts)) {
    await writeFile(path.join(sourceRoot, relativePath), contents);
  }
  if (Object.keys(seedPosts).length > 0) {
    await git(sourceRoot, 'add', '.');
    await git(sourceRoot, 'commit', '-m', 'seed posts');
  }
  const sourceHead = await git(sourceRoot, 'rev-parse', 'HEAD');
  const server = await startHttpsGitServer(sourceRoot);
  return {
    sourceRoot,
    sourceHead,
    privateRoot,
    workBase,
    outboxRoot,
    server,
    adapter: (
      forceExportFormat?: 'format-patch',
      author: { name: string; email: string } = {
        name: 'Publish Bot',
        email: 'publish@example.test',
      },
    ) =>
      new PublicBlogAdapter({
        privateRoot,
        remote: server.remote,
        branch: 'main',
        workBase,
        outboxRoot,
        author,
        remotePolicy: new LoopbackTestRemotePolicy(server.certificateAuthority),
        ...(forceExportFormat === undefined ? {} : { forceExportFormat }),
      }),
    async close() {
      await server.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

async function onlyAsset(adapter: PublicBlogAdapter) {
  const assets = await adapter.listAssets(documentId);
  const asset = assets[0];
  if (!asset) throw new Error('expected public asset');
  return asset;
}

/*
 * 이 묶음은 진짜 git·TLS 위에서 돈다(로컬 HTTPS fixture). 기본 5초로는 다른 파일과 함께 돌
 * 때 아슬아슬해 실제로 한 번 흔들렸다. 느린 것을 감추지 말고 시간을 명시한다.
 */
describe('PublicBlogAdapter 가져오기', { timeout: 30_000 }, () => {
  it('글과 그 시점의 커밋을 함께 읽고, 임시 clone 을 남기지 않는다', async () => {
    const fixture = await createFixture({
      [`${BLOG_LAYOUT.postsDir}/alpha.mdoc`]: `---\ntitle: 알파\nslug: alpha\ncategory: Programming\nupdatedAt: 2026-08-01\ndraft: false\n---\n\n본문\n`,
      [`${BLOG_LAYOUT.postsDir}/beta.mdoc`]: `---\ntitle: 베타\nslug: beta\ncategory: Programming\nupdatedAt: 2026-08-02\ndraft: true\n---\n\n본문\n`,
      // 프론트매터가 깨진 글도 목록에서 빼지 않는다 — 사라지면 블로그에 없는 글로 오해한다.
      [`${BLOG_LAYOUT.postsDir}/broken.mdoc`]: `---\ntitle: [깨진\n---\n\n본문\n`,
    });

    const result = await fixture.adapter().listImportablePosts();

    expect(result.commit).toBe(fixture.sourceHead);
    expect(result.posts.map((post) => post.slug)).toEqual(['alpha', 'beta', 'broken']);
    // draft 상태를 그대로 보여 줘야 무엇을 가져올지 판단할 수 있다.
    expect(result.posts.map((post) => post.draft)).toEqual([false, true, false]);
    expect(result.posts[0]?.repoPath).toBe(`${BLOG_LAYOUT.postsDir}/alpha.mdoc`);
    // 읽기만 했으므로 세션으로 남길 이유가 없다.
    expect(await readdir(fixture.workBase)).toEqual([]);
  });
});

async function cloneConsumer(fixture: Awaited<ReturnType<typeof createFixture>>): Promise<string> {
  const consumer = path.join(path.dirname(fixture.sourceRoot), `consumer-${Date.now()}`);
  await git(
    '',
    '-c',
    `http.sslCAInfo=${fixture.server.certificateAuthority}`,
    'clone',
    fixture.server.remote,
    consumer,
  );
  // 이 clone 은 "사람이 산출물을 받아 적용하는 자리"를 흉내 낸다. `git am` 은 committer
  // identity 를 요구하므로 저장소 안에 직접 심는다 — 테스트가 실행하는 기계의 전역 git
  // 설정에 기대면 개발자 머신에서는 통과하고 깨끗한 CI 러너에서는 실패한다.
  await git(consumer, 'config', 'user.name', 'Consumer');
  await git(consumer, 'config', 'user.email', 'consumer@example.test');
  return consumer;
}

async function git(root: string, ...args: string[]): Promise<string> {
  const gitArgs = root === '' ? args : ['-C', root, ...args];
  const { stdout } = await run('git', gitArgs, { encoding: 'utf8', maxBuffer: 20_000_000 });
  return stdout.trim();
}

describe('NOR-196 책 내보내기', { timeout: 30_000 }, () => {
  it('NOR-196 AC-13: 책 내보내기 검토는 diff 를 돌려주고 확정하면 책 JSON 과 표지를 커밋한다', async () => {
    const fixture = await createFixture();
    try {
      await mkdir(path.join(fixture.privateRoot, 'books'), { recursive: true });
      await mkdir(path.join(fixture.privateRoot, 'assets/books'), { recursive: true });
      await writeFile(
        path.join(fixture.privateRoot, 'books/책.md'),
        '---\ntitle: 책\nkind: book\ncreatedAt: 2026-01-01\nupdatedAt: 2026-01-01\nauthors: [저자]\nstatus: reading\nformat: paper\nsource: purchase\ncover: assets/books/cover.png\n---\n',
      );
      const png = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489',
        'hex',
      );
      await writeFile(path.join(fixture.privateRoot, 'assets/books/cover.png'), png);
      const adapter = fixture.adapter();
      expect(adapter).toHaveProperty('reviewBook');
      expect(adapter).toHaveProperty('publishBook');
      const review = await Reflect.apply(Reflect.get(adapter, 'reviewBook'), adapter, ['책']);
      expect(review.diff).toContain('"title": "책"');
      const result = await Reflect.apply(Reflect.get(adapter, 'publishBook'), adapter, [
        '책',
        { confirmPublish: true, reviewId: review.reviewId },
      ]);
      const consumer = await cloneConsumer(fixture);
      await git(
        consumer,
        'fetch',
        path.join(fixture.outboxRoot, result.exportRef),
        `${result.branch}:${result.branch}`,
      );
      await git(consumer, 'switch', result.branch);
      expect(
        JSON.parse(await readFile(path.join(consumer, BLOG_LAYOUT.booksDir, '책.json'), 'utf8'))
          .title,
      ).toBe('책');
      expect(await readFile(path.join(consumer, BLOG_LAYOUT.bookCoversDir, '책.png'))).toEqual(png);
    } finally {
      await fixture.close();
    }
  });
});
